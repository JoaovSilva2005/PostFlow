-- Preparação para tenancy real. Teste em homologação e faça backup antes.
-- Esta migração remove o acesso anônimo aos dados de negócio.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.brand_members (
  brand_id uuid not null references public.brands(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'viewer'
    check (role in ('owner', 'admin', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (brand_id, user_id)
);

create index if not exists idx_brand_members_user_id
  on public.brand_members(user_id);

alter table public.profiles enable row level security;
alter table public.brand_members enable row level security;

revoke all on public.users from anon, authenticated;
revoke all on public.brands from anon;
revoke all on public.post_drafts from anon;
revoke all on public.post_hashtags from anon;
revoke all on public.financial_transactions from anon;
revoke all on public.brand_members from anon;

grant select, update on public.profiles to authenticated;
grant select on public.brand_members to authenticated;
grant select, insert, update on public.brands to authenticated;
grant select, insert, update, delete on public.post_drafts to authenticated;
grant select, insert, update, delete on public.post_hashtags to authenticated;
grant select, insert, update, delete on public.financial_transactions to authenticated;

drop policy if exists "profile_owner_access" on public.profiles;
create policy "profile_owner_access" on public.profiles
for all to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "member_can_read_membership" on public.brand_members;
create policy "member_can_read_membership" on public.brand_members
for select to authenticated using (user_id = auth.uid());

-- As políticas demo devem ser removidas apenas depois de inserir os memberships
-- das marcas existentes e trocar o frontend pelo BFF. O script propositalmente
-- não inventa o UUID do proprietário nem torna dados órfãos acessíveis.
