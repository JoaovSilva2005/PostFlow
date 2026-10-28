-- Publicação agendada: colunas de controle, status ampliados e RPC de claim.
begin;

alter table public.post_drafts
  add column if not exists published_at timestamptz,
  add column if not exists publishing_started_at timestamptz,
  add column if not exists publish_attempts integer not null default 0,
  add column if not exists publish_error text,
  add column if not exists publish_mode text,
  add column if not exists external_post_id text,
  add column if not exists external_post_url text,
  add column if not exists approved_at timestamptz;

alter table public.post_drafts
  drop constraint if exists post_drafts_publish_mode_check;
alter table public.post_drafts
  add constraint post_drafts_publish_mode_check check (
    publish_mode is null or publish_mode in ('demo', 'live')
  );

alter table public.post_drafts
  drop constraint if exists post_drafts_publish_error_length_check;
alter table public.post_drafts
  add constraint post_drafts_publish_error_length_check check (
    publish_error is null or char_length(publish_error) <= 500
  );

alter table public.post_drafts
  drop constraint if exists post_drafts_status_check;
alter table public.post_drafts
  add constraint post_drafts_status_check check (
    status in ('draft', 'scheduled', 'publishing', 'published', 'failed')
  );

-- Nenhum agendamento anterior foi aprovado no novo sentido.
update public.post_drafts
   set status = 'draft'
 where status = 'scheduled';

create index if not exists idx_post_drafts_due_scheduled
  on public.post_drafts (scheduled_at)
  where status = 'scheduled';

create or replace function public.claim_due_post_drafts(p_limit integer, p_now timestamptz)
returns setof public.post_drafts
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_limit is null or p_limit < 1 or p_now is null then
    raise exception using errcode = '22023', message = 'invalid_claim_arguments';
  end if;

  -- 1. publishing parado: conclui se já houver id externo, senão reagenda.
  update public.post_drafts as post
     set status = case when post.external_post_id is not null
           then 'published' else 'scheduled' end,
         published_at = case when post.external_post_id is not null
           then coalesce(post.published_at, p_now) else post.published_at end,
         publishing_started_at = null,
         updated_at = now()
   where post.status = 'publishing'
     and post.publishing_started_at < p_now - interval '15 minutes';

  -- 2. horário perdido há mais de 2 horas.
  update public.post_drafts as post
     set status = 'failed',
         publish_error = 'Horário perdido: o post não foi publicado até 2 horas após o horário agendado.',
         updated_at = now()
   where post.status = 'scheduled'
     and post.scheduled_at < p_now - interval '2 hours';

  -- 3. claim atômico do lote vencido.
  return query
  with due as (
    select candidate.id
      from public.post_drafts as candidate
     where candidate.status = 'scheduled'
       and candidate.scheduled_at <= p_now
     order by candidate.scheduled_at
     limit p_limit
       for update skip locked
  )
  update public.post_drafts as post
     set status = 'publishing',
         publishing_started_at = p_now,
         publish_attempts = post.publish_attempts + 1,
         updated_at = now()
    from due
   where post.id = due.id
  returning post.*;
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
         approved_at = case when p_patch ? 'approved_at'
           then (p_patch->>'approved_at')::timestamptz else post.approved_at end,
         publish_error = case when p_patch ? 'publish_error'
           then p_patch->>'publish_error' else post.publish_error end,
         publish_attempts = case when p_patch ? 'publish_attempts'
           then (p_patch->>'publish_attempts')::integer else post.publish_attempts end,
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

revoke all on function public.claim_due_post_drafts(integer, timestamptz)
  from public, anon, authenticated;
revoke all on function public.update_post_draft_with_hashtags(uuid, uuid, jsonb, text[])
  from public, anon, authenticated;

grant execute on function public.claim_due_post_drafts(integer, timestamptz)
  to service_role;
grant execute on function public.update_post_draft_with_hashtags(uuid, uuid, jsonb, text[])
  to service_role;

commit;
