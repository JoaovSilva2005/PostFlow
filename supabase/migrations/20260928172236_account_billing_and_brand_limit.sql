begin;

-- A assinatura paga em uma marca pertence à conta que a criou. A mesma conta
-- pode usar essa franquia nas demais marcas próprias, com limite de duas.
create or replace function public.create_brand_with_owner(
  p_user_id uuid,
  p_brand jsonb
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_brand public.brands%rowtype;
  v_owned_brand_count integer;
begin
  if p_user_id is null or p_brand is null
    or jsonb_typeof(p_brand) <> 'object' then
    raise exception using errcode = '22023', message = 'invalid_brand';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_user_id::text, 0)
  );

  if not exists (
    select 1
      from public.platform_members as member
     where member.user_id = p_user_id
       and member.role = 'platform_owner'
  ) then
    select count(*)::integer
      into v_owned_brand_count
      from public.brands as brand
     where brand.user_id = p_user_id;

    if v_owned_brand_count >= 2 then
      raise exception using
        errcode = '23514',
        message = 'brand_limit_reached';
    end if;
  end if;

  insert into public.brands (
    user_id, name, segment, tone_of_voice, primary_color, color_palette,
    description, target_audience, products_or_services, differentials,
    content_goals, keywords, avoid_topics, default_cta
  ) values (
    p_user_id,
    p_brand->>'name',
    p_brand->>'segment',
    p_brand->>'tone_of_voice',
    p_brand->>'primary_color',
    coalesce(p_brand->'color_palette', '["#4F46E5"]'::jsonb),
    coalesce(p_brand->>'description', ''),
    coalesce(p_brand->>'target_audience', ''),
    coalesce(p_brand->>'products_or_services', ''),
    coalesce(p_brand->>'differentials', ''),
    coalesce(p_brand->>'content_goals', ''),
    coalesce(p_brand->>'keywords', ''),
    coalesce(p_brand->>'avoid_topics', ''),
    coalesce(p_brand->>'default_cta', '')
  ) returning * into v_brand;

  insert into public.brand_members(brand_id, user_id, role)
  values (v_brand.id, p_user_id, 'owner');

  return to_jsonb(v_brand);
end;
$$;

revoke all on function public.create_brand_with_owner(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.create_brand_with_owner(uuid, jsonb)
  to service_role;

commit;
