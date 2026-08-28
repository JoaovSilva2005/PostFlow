-- PostFlow - PostgreSQL/Supabase schema
-- Execute este arquivo primeiro no SQL Editor do Supabase.

create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  display_name text not null,
  created_at timestamptz not null default now(),
  constraint users_email_length_check check (length(trim(email)) >= 5),
  constraint users_display_name_length_check check (
    length(trim(display_name)) >= 2
  )
);

create table if not exists public.brands (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  name text not null,
  segment text not null,
  tone_of_voice text not null,
  primary_color text not null default '#4F46E5',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint brands_user_id_fkey
    foreign key (user_id) references public.users (id) on delete cascade,
  constraint brands_name_length_check check (length(trim(name)) >= 2),
  constraint brands_primary_color_check check (
    primary_color ~ '^#[0-9A-Fa-f]{6}$'
  )
);

create table if not exists public.social_platforms (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  character_limit integer not null,
  constraint social_platforms_character_limit_check check (
    character_limit > 0
  )
);

create table if not exists public.post_drafts (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null,
  platform_id uuid not null,
  title text not null,
  caption text not null,
  visual_text text not null,
  color text not null default '#4F46E5',
  scheduled_at timestamptz not null,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint post_drafts_brand_id_fkey
    foreign key (brand_id) references public.brands (id) on delete cascade,
  constraint post_drafts_platform_id_fkey
    foreign key (platform_id)
    references public.social_platforms (id)
    on delete restrict,
  constraint post_drafts_title_length_check check (
    length(trim(title)) >= 3
  ),
  constraint post_drafts_status_check check (
    status in ('draft', 'scheduled', 'published')
  ),
  constraint post_drafts_color_check check (color ~ '^#[0-9A-Fa-f]{6}$')
);

create table if not exists public.post_hashtags (
  post_id uuid not null,
  hashtag text not null,
  primary key (post_id, hashtag),
  constraint post_hashtags_post_id_fkey
    foreign key (post_id)
    references public.post_drafts (id)
    on delete cascade,
  constraint post_hashtags_format_check check (hashtag ~ '^#[^[:space:]#]+$')
);

create index if not exists idx_brands_user_id
  on public.brands (user_id);
create index if not exists idx_post_drafts_brand_id
  on public.post_drafts (brand_id);
create index if not exists idx_post_drafts_platform_id
  on public.post_drafts (platform_id);
create index if not exists idx_post_drafts_scheduled_at
  on public.post_drafts (scheduled_at);
create index if not exists idx_post_drafts_status
  on public.post_drafts (status);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists brands_set_updated_at on public.brands;
create trigger brands_set_updated_at
before update on public.brands
for each row execute function public.set_updated_at();

drop trigger if exists post_drafts_set_updated_at on public.post_drafts;
create trigger post_drafts_set_updated_at
before update on public.post_drafts
for each row execute function public.set_updated_at();

-- Segurança da demonstração acadêmica.
-- A aplicação usa somente o usuário fixo abaixo e uma chave publicável.
alter table public.users enable row level security;
alter table public.brands enable row level security;
alter table public.social_platforms enable row level security;
alter table public.post_drafts enable row level security;
alter table public.post_hashtags enable row level security;

revoke all on table public.users from anon, authenticated;
revoke all on table public.brands from anon, authenticated;
revoke all on table public.social_platforms from anon, authenticated;
revoke all on table public.post_drafts from anon, authenticated;
revoke all on table public.post_hashtags from anon, authenticated;

grant select on table public.users to anon, authenticated;
grant select, insert, update on table public.brands to anon, authenticated;
grant select on table public.social_platforms to anon, authenticated;
grant select, insert, update, delete
  on table public.post_drafts to anon, authenticated;
grant select, insert, update, delete
  on table public.post_hashtags to anon, authenticated;

drop policy if exists "demo_user_can_be_read" on public.users;
create policy "demo_user_can_be_read"
on public.users for select
to anon, authenticated
using (id = '00000000-0000-0000-0000-000000000001'::uuid);

drop policy if exists "demo_brand_can_be_read" on public.brands;
create policy "demo_brand_can_be_read"
on public.brands for select
to anon, authenticated
using (user_id = '00000000-0000-0000-0000-000000000001'::uuid);

drop policy if exists "demo_brand_can_be_created" on public.brands;
create policy "demo_brand_can_be_created"
on public.brands for insert
to anon, authenticated
with check (user_id = '00000000-0000-0000-0000-000000000001'::uuid);

drop policy if exists "demo_brand_can_be_updated" on public.brands;
create policy "demo_brand_can_be_updated"
on public.brands for update
to anon, authenticated
using (user_id = '00000000-0000-0000-0000-000000000001'::uuid)
with check (user_id = '00000000-0000-0000-0000-000000000001'::uuid);

drop policy if exists "platforms_can_be_read" on public.social_platforms;
create policy "platforms_can_be_read"
on public.social_platforms for select
to anon, authenticated
using (true);

drop policy if exists "demo_posts_can_be_read" on public.post_drafts;
create policy "demo_posts_can_be_read"
on public.post_drafts for select
to anon, authenticated
using (
  exists (
    select 1
    from public.brands
    where brands.id = post_drafts.brand_id
      and brands.user_id = '00000000-0000-0000-0000-000000000001'::uuid
  )
);

drop policy if exists "demo_posts_can_be_created" on public.post_drafts;
create policy "demo_posts_can_be_created"
on public.post_drafts for insert
to anon, authenticated
with check (
  exists (
    select 1
    from public.brands
    where brands.id = post_drafts.brand_id
      and brands.user_id = '00000000-0000-0000-0000-000000000001'::uuid
  )
);

drop policy if exists "demo_posts_can_be_updated" on public.post_drafts;
create policy "demo_posts_can_be_updated"
on public.post_drafts for update
to anon, authenticated
using (
  exists (
    select 1
    from public.brands
    where brands.id = post_drafts.brand_id
      and brands.user_id = '00000000-0000-0000-0000-000000000001'::uuid
  )
)
with check (
  exists (
    select 1
    from public.brands
    where brands.id = post_drafts.brand_id
      and brands.user_id = '00000000-0000-0000-0000-000000000001'::uuid
  )
);

drop policy if exists "demo_posts_can_be_deleted" on public.post_drafts;
create policy "demo_posts_can_be_deleted"
on public.post_drafts for delete
to anon, authenticated
using (
  exists (
    select 1
    from public.brands
    where brands.id = post_drafts.brand_id
      and brands.user_id = '00000000-0000-0000-0000-000000000001'::uuid
  )
);

drop policy if exists "demo_hashtags_can_be_read" on public.post_hashtags;
create policy "demo_hashtags_can_be_read"
on public.post_hashtags for select
to anon, authenticated
using (
  exists (
    select 1
    from public.post_drafts
    join public.brands on brands.id = post_drafts.brand_id
    where post_drafts.id = post_hashtags.post_id
      and brands.user_id = '00000000-0000-0000-0000-000000000001'::uuid
  )
);

drop policy if exists "demo_hashtags_can_be_created" on public.post_hashtags;
create policy "demo_hashtags_can_be_created"
on public.post_hashtags for insert
to anon, authenticated
with check (
  exists (
    select 1
    from public.post_drafts
    join public.brands on brands.id = post_drafts.brand_id
    where post_drafts.id = post_hashtags.post_id
      and brands.user_id = '00000000-0000-0000-0000-000000000001'::uuid
  )
);

drop policy if exists "demo_hashtags_can_be_updated" on public.post_hashtags;
create policy "demo_hashtags_can_be_updated"
on public.post_hashtags for update
to anon, authenticated
using (
  exists (
    select 1
    from public.post_drafts
    join public.brands on brands.id = post_drafts.brand_id
    where post_drafts.id = post_hashtags.post_id
      and brands.user_id = '00000000-0000-0000-0000-000000000001'::uuid
  )
)
with check (
  exists (
    select 1
    from public.post_drafts
    join public.brands on brands.id = post_drafts.brand_id
    where post_drafts.id = post_hashtags.post_id
      and brands.user_id = '00000000-0000-0000-0000-000000000001'::uuid
  )
);

drop policy if exists "demo_hashtags_can_be_deleted" on public.post_hashtags;
create policy "demo_hashtags_can_be_deleted"
on public.post_hashtags for delete
to anon, authenticated
using (
  exists (
    select 1
    from public.post_drafts
    join public.brands on brands.id = post_drafts.brand_id
    where post_drafts.id = post_hashtags.post_id
      and brands.user_id = '00000000-0000-0000-0000-000000000001'::uuid
  )
);
