begin;

alter table public.post_drafts
  add column if not exists content_format text not null default 'static',
  add column if not exists audience_persona text not null default '',
  add column if not exists schedule_timezone text not null default 'America/Sao_Paulo',
  add column if not exists format_data jsonb;

alter table public.post_drafts
  drop constraint if exists post_drafts_content_format_check;
alter table public.post_drafts
  add constraint post_drafts_content_format_check
  check (content_format in ('carousel', 'static', 'reels'));

alter table public.post_drafts
  drop constraint if exists post_drafts_audience_persona_length_check;
alter table public.post_drafts
  add constraint post_drafts_audience_persona_length_check
  check (length(audience_persona) <= 160);

alter table public.post_drafts
  drop constraint if exists post_drafts_format_data_object_check;
alter table public.post_drafts
  add constraint post_drafts_format_data_object_check
  check (format_data is null or jsonb_typeof(format_data) = 'object');

insert into public.social_platforms (name, character_limit) values
  ('Instagram', 2200),
  ('Facebook', 63206),
  ('X / Twitter', 280),
  ('LinkedIn', 3000),
  ('TikTok', 2200),
  ('Blog', 30000)
on conflict (name) do update
  set character_limit = excluded.character_limit;

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
  v_post_id uuid;
  v_ids uuid[] := array[]::uuid[];
begin
  if p_drafts is null
    or jsonb_typeof(p_drafts) <> 'array'
    or jsonb_array_length(p_drafts) < 1
    or jsonb_array_length(p_drafts) > 42 then
    raise exception 'invalid_post_drafts_batch';
  end if;

  for v_item in select value from jsonb_array_elements(p_drafts)
  loop
    select id into v_platform_id
      from public.social_platforms
     where name = v_item->>'platform';

    if v_platform_id is null then
      raise exception 'social_platform_not_found';
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
    select v_post_id, hashtag.value
      from jsonb_array_elements_text(coalesce(v_item->'hashtags', '[]'::jsonb)) as hashtag(value)
    on conflict (post_id, hashtag) do nothing;

    v_ids := array_append(v_ids, v_post_id);
  end loop;

  return v_ids;
end;
$$;

revoke all on function public.create_post_drafts_batch(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.create_post_drafts_batch(uuid, jsonb)
  to service_role;

commit;
