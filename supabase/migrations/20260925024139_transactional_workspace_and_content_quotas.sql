begin;

-- A franquia separa o que foi consumido do que está reservado por uma
-- solicitação em andamento. Todas as alterações são serializadas por período.
alter table public.usage_counters
  add column if not exists text_reserved integer not null default 0,
  add column if not exists image_reserved integer not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'usage_counters_text_reserved_check'
      and conrelid = 'public.usage_counters'::regclass
  ) then
    alter table public.usage_counters
      add constraint usage_counters_text_reserved_check
      check (text_reserved >= 0);
  end if;
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'usage_counters_image_reserved_check'
      and conrelid = 'public.usage_counters'::regclass
  ) then
    alter table public.usage_counters
      add constraint usage_counters_image_reserved_check
      check (image_reserved >= 0);
  end if;
end;
$$;

create table if not exists public.content_generation_reservations (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null,
  period_start date not null,
  text_units integer not null check (text_units >= 0),
  image_units integer not null check (image_units >= 0),
  status text not null default 'reserved'
    check (status in ('reserved', 'consumed', 'released')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '1 hour'),
  finalized_at timestamptz,
  foreign key (brand_id, period_start)
    references public.usage_counters(brand_id, period_start)
    on delete cascade,
  check (text_units + image_units > 0)
);

create index if not exists content_generation_reservations_expiry_idx
  on public.content_generation_reservations
    (brand_id, period_start, expires_at)
  where status = 'reserved';

alter table public.content_generation_reservations enable row level security;
revoke all on public.content_generation_reservations from public, anon, authenticated;
grant select, insert, update, delete
  on public.content_generation_reservations to service_role;
grant select, insert, update, delete
  on public.usage_counters to service_role;

create or replace function public.release_expired_content_generation_reservations(
  p_brand_id uuid,
  p_period_start date
) returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_expired_text integer := 0;
  v_expired_image integer := 0;
begin
  if p_brand_id is null or p_period_start is null then
    raise exception using errcode = '22023', message = 'invalid_usage_period';
  end if;

  perform 1
    from public.usage_counters as counter
   where counter.brand_id = p_brand_id
     and counter.period_start = p_period_start
   for update;
  if not found then return; end if;

  with expired as (
    update public.content_generation_reservations as reservation
       set status = 'released', finalized_at = now()
     where reservation.brand_id = p_brand_id
       and reservation.period_start = p_period_start
       and reservation.status = 'reserved'
       and reservation.expires_at <= now()
     returning reservation.text_units, reservation.image_units
  )
  select coalesce(sum(expired.text_units), 0)::integer,
         coalesce(sum(expired.image_units), 0)::integer
    into v_expired_text, v_expired_image
    from expired;

  update public.usage_counters as counter
     set text_reserved = greatest(0, counter.text_reserved - v_expired_text),
         image_reserved = greatest(0, counter.image_reserved - v_expired_image),
         updated_at = now()
   where counter.brand_id = p_brand_id
     and counter.period_start = p_period_start;
end;
$$;

-- Unidade de texto: cada item persistível gerado. Uma geração individual também
-- reserva uma imagem; o lote atual não solicita imagens ao provedor.
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
     and plan.active
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

create or replace function public.settle_content_generation_usage(
  p_reservation_id uuid,
  p_succeeded boolean
) returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_brand_id uuid;
  v_period_start date;
  v_reservation public.content_generation_reservations%rowtype;
begin
  if p_reservation_id is null or p_succeeded is null then
    raise exception using errcode = '22023', message = 'invalid_reservation';
  end if;

  select reservation.brand_id, reservation.period_start
    into v_brand_id, v_period_start
    from public.content_generation_reservations as reservation
   where reservation.id = p_reservation_id;
  if not found then return false; end if;

  -- Sempre bloqueia primeiro o contador e depois a reserva, na mesma ordem da
  -- reserva/criação, para serializar concorrência sem deadlock entre caminhos.
  perform 1
    from public.usage_counters as counter
   where counter.brand_id = v_brand_id
     and counter.period_start = v_period_start
   for update;

  select reservation.*
    into v_reservation
    from public.content_generation_reservations as reservation
   where reservation.id = p_reservation_id
   for update;
  if not found or v_reservation.status <> 'reserved' then return false; end if;

  update public.usage_counters as counter
     set text_reserved = counter.text_reserved - v_reservation.text_units,
         image_reserved = counter.image_reserved - v_reservation.image_units,
         text_used = counter.text_used +
           case when p_succeeded then v_reservation.text_units else 0 end,
         image_used = counter.image_used +
           case when p_succeeded then v_reservation.image_units else 0 end,
         updated_at = now()
   where counter.brand_id = v_brand_id
     and counter.period_start = v_period_start;

  update public.content_generation_reservations as reservation
     set status = case when p_succeeded then 'consumed' else 'released' end,
         finalized_at = now()
   where reservation.id = p_reservation_id;

  return true;
end;
$$;

-- Toda criação/edição de rascunho e suas hashtags acontece dentro de uma RPC,
-- portanto qualquer erro desfaz todas as gravações do mesmo pedido.
create or replace function public.create_post_draft_with_hashtags(
  p_brand_id uuid,
  p_draft jsonb
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_post public.post_drafts%rowtype;
  v_platform_name text;
  v_platform_limit integer;
  v_hashtag_text text;
begin
  if p_brand_id is null or p_draft is null
    or jsonb_typeof(p_draft) <> 'object'
    or jsonb_typeof(coalesce(p_draft->'hashtags', '[]'::jsonb)) <> 'array'
    or char_length(p_draft->>'caption') > 5000
    or char_length(p_draft->>'visual_text') > 160 then
    raise exception using errcode = '22023', message = 'invalid_post_draft';
  end if;

  select platform.name, platform.character_limit
    into v_platform_name, v_platform_limit
    from public.social_platforms as platform
   where platform.id = (p_draft->>'platform_id')::uuid;
  if not found then
    raise exception using errcode = '22023', message = 'social_platform_not_found';
  end if;

  select coalesce(string_agg(tag.value, ' ' order by tag.item_order), '')
    into v_hashtag_text
    from jsonb_array_elements_text(
      coalesce(p_draft->'hashtags', '[]'::jsonb)
    ) with ordinality as tag(value, item_order);
  if char_length(
    coalesce(p_draft->>'caption', '') ||
    case when v_hashtag_text = '' then '' else E'\n' || v_hashtag_text end
  ) > v_platform_limit then
    raise exception using errcode = '22023',
      message = 'platform_character_limit_exceeded';
  end if;

  insert into public.post_drafts (
    brand_id, platform_id, title, caption, visual_text, color, scheduled_at,
    status, content_format, audience_persona, schedule_timezone, format_data
  ) values (
    p_brand_id,
    (p_draft->>'platform_id')::uuid,
    p_draft->>'title',
    p_draft->>'caption',
    p_draft->>'visual_text',
    coalesce(p_draft->>'color', '#4F46E5'),
    (p_draft->>'scheduled_at')::timestamptz,
    p_draft->>'status',
    coalesce(p_draft->>'content_format', 'static'),
    coalesce(p_draft->>'audience_persona', ''),
    coalesce(p_draft->>'schedule_timezone', 'America/Sao_Paulo'),
    p_draft->'format_data'
  ) returning * into v_post;

  insert into public.post_hashtags(post_id, hashtag)
  select v_post.id, tag.value
    from jsonb_array_elements_text(
      coalesce(p_draft->'hashtags', '[]'::jsonb)
    ) as tag(value)
  on conflict (post_id, hashtag) do nothing;

  return to_jsonb(v_post) || jsonb_build_object(
    'social_platforms', jsonb_build_object('name', v_platform_name),
    'post_hashtags', (
      select coalesce(
        jsonb_agg(jsonb_build_object('hashtag', hashtag.hashtag)
          order by hashtag.hashtag),
        '[]'::jsonb
      )
        from public.post_hashtags as hashtag
       where hashtag.post_id = v_post.id
    )
  );
end;
$$;

create or replace function public.update_post_draft_with_hashtags(
  p_brand_id uuid,
  p_post_id uuid,
  p_patch jsonb,
  p_hashtags text[] default null
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_post public.post_drafts%rowtype;
  v_platform_name text;
  v_platform_limit integer;
  v_hashtag_text text;
begin
  if p_brand_id is null or p_post_id is null or p_patch is null
    or jsonb_typeof(p_patch) <> 'object'
    or (p_patch ? 'caption' and char_length(p_patch->>'caption') > 5000)
    or (p_patch ? 'visual_text' and char_length(p_patch->>'visual_text') > 160) then
    raise exception using errcode = '22023', message = 'invalid_post_draft_patch';
  end if;

  update public.post_drafts as post
     set platform_id = case when p_patch ? 'platform_id'
           then (p_patch->>'platform_id')::uuid else post.platform_id end,
         title = case when p_patch ? 'title'
           then p_patch->>'title' else post.title end,
         caption = case when p_patch ? 'caption'
           then p_patch->>'caption' else post.caption end,
         visual_text = case when p_patch ? 'visual_text'
           then p_patch->>'visual_text' else post.visual_text end,
         color = case when p_patch ? 'color'
           then p_patch->>'color' else post.color end,
         scheduled_at = case when p_patch ? 'scheduled_at'
           then (p_patch->>'scheduled_at')::timestamptz else post.scheduled_at end,
         schedule_timezone = case when p_patch ? 'schedule_timezone'
           then p_patch->>'schedule_timezone' else post.schedule_timezone end,
         content_format = case when p_patch ? 'content_format'
           then p_patch->>'content_format' else post.content_format end,
         format_data = case when p_patch ? 'format_data'
           then p_patch->'format_data' else post.format_data end,
         audience_persona = case when p_patch ? 'audience_persona'
           then p_patch->>'audience_persona' else post.audience_persona end,
         status = case when p_patch ? 'status'
           then p_patch->>'status' else post.status end,
         updated_at = now()
   where post.id = p_post_id
     and post.brand_id = p_brand_id
  returning post.* into v_post;
  if not found then return null; end if;

  if p_hashtags is not null then
    delete from public.post_hashtags as hashtag
     where hashtag.post_id = p_post_id;
    insert into public.post_hashtags(post_id, hashtag)
    select p_post_id, tag.hashtag
      from unnest(p_hashtags) as tag(hashtag)
    on conflict (post_id, hashtag) do nothing;
  end if;

  select platform.name, platform.character_limit
    into v_platform_name, v_platform_limit
    from public.social_platforms as platform
   where platform.id = v_post.platform_id;

  select coalesce(string_agg(hashtag.hashtag, ' ' order by hashtag.hashtag), '')
    into v_hashtag_text
    from public.post_hashtags as hashtag
   where hashtag.post_id = v_post.id;
  if char_length(
    coalesce(v_post.caption, '') ||
    case when v_hashtag_text = '' then '' else E'\n' || v_hashtag_text end
  ) > v_platform_limit then
    raise exception using errcode = '22023',
      message = 'platform_character_limit_exceeded';
  end if;

  return to_jsonb(v_post) || jsonb_build_object(
    'social_platforms', jsonb_build_object('name', v_platform_name),
    'post_hashtags', (
      select coalesce(
        jsonb_agg(jsonb_build_object('hashtag', hashtag.hashtag)
          order by hashtag.hashtag),
        '[]'::jsonb
      )
        from public.post_hashtags as hashtag
       where hashtag.post_id = v_post.id
    )
  );
end;
$$;

-- O mesmo contrato de tamanho/plataforma vale para a RPC histórica de lote.
create or replace function public.create_post_drafts_batch(
  p_brand_id uuid,
  p_drafts jsonb
) returns uuid[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_platform_id uuid;
  v_platform_limit integer;
  v_post_id uuid;
  v_caption text;
  v_hashtag_text text;
  v_ids uuid[] := array[]::uuid[];
begin
  if p_brand_id is null
    or p_drafts is null
    or jsonb_typeof(p_drafts) <> 'array'
    or jsonb_array_length(p_drafts) < 1
    or jsonb_array_length(p_drafts) > 42 then
    raise exception 'invalid_post_drafts_batch';
  end if;

  for v_item in select value from jsonb_array_elements(p_drafts)
  loop
    if jsonb_typeof(coalesce(v_item->'hashtags', '[]'::jsonb)) <> 'array'
      or char_length(v_item->>'caption') > 5000
      or char_length(v_item->>'visualText') > 160 then
      raise exception using errcode = '22023', message = 'invalid_post_draft';
    end if;

    select platform.id, platform.character_limit
      into v_platform_id, v_platform_limit
      from public.social_platforms as platform
     where platform.name = v_item->>'platform';

    if v_platform_id is null then
      raise exception 'social_platform_not_found';
    end if;

    v_caption := coalesce(v_item->>'caption', '');
    select coalesce(string_agg(tag.value, ' ' order by tag.item_order), '')
      into v_hashtag_text
      from jsonb_array_elements_text(
        coalesce(v_item->'hashtags', '[]'::jsonb)
      ) with ordinality as tag(value, item_order);
    if char_length(
      v_caption ||
      case when v_hashtag_text = '' then '' else E'\n' || v_hashtag_text end
    ) > v_platform_limit then
      raise exception using errcode = '22023',
        message = 'platform_character_limit_exceeded';
    end if;

    insert into public.post_drafts (
      id, brand_id, platform_id, title, caption, visual_text, color,
      scheduled_at, status, content_format, audience_persona,
      schedule_timezone, format_data
    ) values (
      coalesce(nullif(v_item->>'id', '')::uuid, gen_random_uuid()),
      p_brand_id,
      v_platform_id,
      v_item->>'title',
      v_item->>'caption',
      v_item->>'visualText',
      coalesce(v_item->>'color', '#4F46E5'),
      ((v_item->>'date')::date + (v_item->>'time')::time)
        at time zone (v_item->>'timezone'),
      'draft',
      v_item->>'format',
      coalesce(v_item->>'persona', ''),
      v_item->>'timezone',
      v_item->'formatData'
    ) returning id into v_post_id;

    insert into public.post_hashtags (post_id, hashtag)
    select v_post_id, tag.value
      from jsonb_array_elements_text(
        coalesce(v_item->'hashtags', '[]'::jsonb)
      ) as tag(value)
    on conflict (post_id, hashtag) do nothing;

    v_ids := array_append(v_ids, v_post_id);
  end loop;

  return v_ids;
end;
$$;

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
begin
  if p_user_id is null or p_brand is null
    or jsonb_typeof(p_brand) <> 'object' then
    raise exception using errcode = '22023', message = 'invalid_brand';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_user_id::text, 0)
  );

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

-- Lock por usuário serializa o primeiro provisionamento, mesmo sem UNIQUE em
-- brands.user_id. A transação inclui users, profiles, marca e membership.
create or replace function public.ensure_default_workspace(
  p_user_id uuid,
  p_email text,
  p_display_name text,
  p_brand_name text,
  p_segment text
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_display_name text;
  v_brand_name text;
  v_segment text;
  v_brand_id uuid;
  v_role text;
begin
  if p_user_id is null or p_email is null then
    raise exception using errcode = '22023', message = 'invalid_workspace_identity';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_user_id::text, 0)
  );

  v_display_name := case
    when pg_catalog.char_length(pg_catalog.btrim(coalesce(p_display_name, ''))) >= 2
      then pg_catalog.left(pg_catalog.btrim(p_display_name), 80)
    else 'Usuário PostFlow'
  end;
  v_brand_name := case
    when pg_catalog.char_length(pg_catalog.btrim(coalesce(p_brand_name, ''))) >= 2
      then pg_catalog.left(pg_catalog.btrim(p_brand_name), 120)
    else pg_catalog.left('Workspace de ' || v_display_name, 120)
  end;
  v_segment := case
    when pg_catalog.char_length(pg_catalog.btrim(coalesce(p_segment, ''))) >= 2
      then pg_catalog.left(pg_catalog.btrim(p_segment), 80)
    else 'A definir'
  end;

  insert into public.users(id, email, display_name)
  values (p_user_id, p_email, v_display_name)
  on conflict (id) do update
    set email = excluded.email,
        display_name = excluded.display_name;

  insert into public.profiles(id, display_name)
  values (p_user_id, v_display_name)
  on conflict (id) do update
    set display_name = excluded.display_name;

  select membership.brand_id, membership.role
    into v_brand_id, v_role
    from public.brand_members as membership
   where membership.user_id = p_user_id
   order by membership.created_at asc
   limit 1;
  if found then
    return jsonb_build_object(
      'workspace_id', v_brand_id, 'user_id', p_user_id, 'role', v_role
    );
  end if;

  select brand.id into v_brand_id
    from public.brands as brand
   where brand.user_id = p_user_id
   order by brand.created_at asc
   limit 1;

  if v_brand_id is null then
    insert into public.brands (
      user_id, name, segment, tone_of_voice, primary_color
    ) values (
      p_user_id,
      v_brand_name,
      v_segment,
      'Profissional e próximo',
      '#4F46E5'
    ) returning id into v_brand_id;
  end if;

  insert into public.brand_members(brand_id, user_id, role)
  values (v_brand_id, p_user_id, 'owner')
  on conflict (brand_id, user_id) do nothing;

  select membership.role into v_role
    from public.brand_members as membership
   where membership.brand_id = v_brand_id
     and membership.user_id = p_user_id;

  return jsonb_build_object(
    'workspace_id', v_brand_id, 'user_id', p_user_id, 'role', v_role
  );
end;
$$;

revoke all on function public.reserve_content_generation_usage(uuid, integer, integer)
  from public, anon, authenticated;
revoke all on function public.release_expired_content_generation_reservations(uuid, date)
  from public, anon, authenticated;
revoke all on function public.settle_content_generation_usage(uuid, boolean)
  from public, anon, authenticated;
revoke all on function public.create_post_draft_with_hashtags(uuid, jsonb)
  from public, anon, authenticated;
revoke all on function public.update_post_draft_with_hashtags(uuid, uuid, jsonb, text[])
  from public, anon, authenticated;
revoke all on function public.create_post_drafts_batch(uuid, jsonb)
  from public, anon, authenticated;
revoke all on function public.create_brand_with_owner(uuid, jsonb)
  from public, anon, authenticated;
revoke all on function public.ensure_default_workspace(uuid, text, text, text, text)
  from public, anon, authenticated;

grant execute on function public.reserve_content_generation_usage(uuid, integer, integer)
  to service_role;
grant execute on function public.release_expired_content_generation_reservations(uuid, date)
  to service_role;
grant execute on function public.settle_content_generation_usage(uuid, boolean)
  to service_role;
grant execute on function public.create_post_draft_with_hashtags(uuid, jsonb)
  to service_role;
grant execute on function public.update_post_draft_with_hashtags(uuid, uuid, jsonb, text[])
  to service_role;
grant execute on function public.create_post_drafts_batch(uuid, jsonb)
  to service_role;
grant execute on function public.create_brand_with_owner(uuid, jsonb)
  to service_role;
grant execute on function public.ensure_default_workspace(uuid, text, text, text, text)
  to service_role;

commit;
