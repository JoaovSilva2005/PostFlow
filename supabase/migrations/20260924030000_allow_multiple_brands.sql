-- Cada marca é um workspace independente. O usuário pode ser dono de várias marcas.
alter table public.brands
  drop constraint if exists brands_user_id_key;

create index if not exists idx_brands_user_id_created_at
  on public.brands (user_id, created_at);
