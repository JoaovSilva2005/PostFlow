begin;

alter table public.post_drafts
  add column if not exists image_path text;

insert into storage.buckets (
  id, name, public, file_size_limit, allowed_mime_types
) values (
  'post-draft-images',
  'post-draft-images',
  false,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp']::text[]
)
on conflict (id) do update set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

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
    id, brand_id, platform_id, title, caption, visual_text, color,
    scheduled_at, status, content_format, audience_persona,
    schedule_timezone, format_data, image_path
  ) values (
    coalesce((p_draft->>'id')::uuid, gen_random_uuid()),
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
    p_draft->'format_data',
    nullif(p_draft->>'image_path', '')
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

revoke all on function public.create_post_draft_with_hashtags(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.create_post_draft_with_hashtags(uuid, jsonb)
  to service_role;

commit;
