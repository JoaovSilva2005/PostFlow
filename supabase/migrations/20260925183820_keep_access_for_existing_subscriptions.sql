begin;

-- `plans.active` controls whether a plan can be offered to new subscribers.
-- Existing active subscriptions keep their contracted access and limits.
create or replace function public.reserve_content_generation_usage(
  p_brand_id uuid,
  p_text_units integer,
  p_image_units integer
) returns table (
  allowed boolean,
  reservation_id uuid,
  failure_code text,
  text_limit integer,
  image_limit integer,
  text_used integer,
  image_used integer,
  text_reserved integer,
  image_reserved integer
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_period_start date;
  v_text_limit integer;
  v_image_limit integer;
  v_counter public.usage_counters%rowtype;
  v_reservation_id uuid;
begin
  if p_brand_id is null
    or p_text_units is null
    or p_image_units is null
    or p_text_units < 0
    or p_image_units < 0
    or p_text_units + p_image_units < 1
    or p_text_units > 42
    or p_image_units > 1 then
    raise exception using errcode = '22023', message = 'invalid_usage_units';
  end if;

  select subscription.current_period_start,
         plan.text_limit,
         plan.image_limit
    into v_period_start, v_text_limit, v_image_limit
    from public.subscriptions as subscription
    join public.plans as plan on plan.id = subscription.plan_id
   where subscription.brand_id = p_brand_id
     and subscription.status in ('active', 'trialing')
   order by subscription.created_at desc
   limit 1;

  if not found then
    return query select false, null::uuid, 'plan_inactive'::text,
      0, 0, 0, 0, 0, 0;
    return;
  end if;

  insert into public.usage_counters (
    brand_id, period_start, text_used, image_used, text_reserved, image_reserved
  ) values (
    p_brand_id, v_period_start, 0, 0, 0, 0
  ) on conflict (brand_id, period_start) do nothing;

  perform public.release_expired_content_generation_reservations(
    p_brand_id,
    v_period_start
  );

  select counter.*
    into v_counter
    from public.usage_counters as counter
   where counter.brand_id = p_brand_id
     and counter.period_start = v_period_start
   for update;

  if v_counter.text_used + v_counter.text_reserved + p_text_units > v_text_limit then
    return query select false, null::uuid, 'text_limit'::text,
      v_text_limit, v_image_limit, v_counter.text_used, v_counter.image_used,
      v_counter.text_reserved, v_counter.image_reserved;
    return;
  end if;
  if v_counter.image_used + v_counter.image_reserved + p_image_units > v_image_limit then
    return query select false, null::uuid, 'image_limit'::text,
      v_text_limit, v_image_limit, v_counter.text_used, v_counter.image_used,
      v_counter.text_reserved, v_counter.image_reserved;
    return;
  end if;

  update public.usage_counters as counter
     set text_reserved = counter.text_reserved + p_text_units,
         image_reserved = counter.image_reserved + p_image_units,
         updated_at = now()
   where counter.brand_id = p_brand_id
     and counter.period_start = v_period_start
  returning counter.* into v_counter;

  insert into public.content_generation_reservations (
    brand_id, period_start, text_units, image_units
  ) values (
    p_brand_id, v_period_start, p_text_units, p_image_units
  ) returning id into v_reservation_id;

  return query select true, v_reservation_id, null::text,
    v_text_limit, v_image_limit, v_counter.text_used, v_counter.image_used,
    v_counter.text_reserved, v_counter.image_reserved;
end;
$$;

revoke all on function public.reserve_content_generation_usage(uuid, integer, integer)
  from public, anon, authenticated;
grant execute on function public.reserve_content_generation_usage(uuid, integer, integer)
  to service_role;

commit;
