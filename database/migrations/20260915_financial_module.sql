-- PostFlow - Épico 3: estrutura do módulo financeiro
-- Migração incremental para um projeto Supabase que já possui o schema inicial.

begin;

create table if not exists public.financial_transactions (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null,
  type text not null,
  category text not null,
  description text not null,
  amount numeric(12, 2) not null,
  due_date date not null,
  status text not null default 'pending',
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint financial_transactions_brand_id_fkey
    foreign key (brand_id) references public.brands (id) on delete cascade,
  constraint financial_transactions_type_check check (
    type in ('income', 'expense')
  ),
  constraint financial_transactions_status_check check (
    status in ('pending', 'paid')
  ),
  constraint financial_transactions_amount_check check (amount > 0),
  constraint financial_transactions_category_length_check check (
    length(trim(category)) >= 2
  ),
  constraint financial_transactions_description_length_check check (
    length(trim(description)) >= 3
  ),
  constraint financial_transactions_paid_at_check check (
    (status = 'paid' and paid_at is not null)
    or (status = 'pending' and paid_at is null)
  )
);

create index if not exists idx_financial_transactions_brand_id
  on public.financial_transactions (brand_id);
create index if not exists idx_financial_transactions_due_date
  on public.financial_transactions (due_date);
create index if not exists idx_financial_transactions_status
  on public.financial_transactions (status);
create index if not exists idx_financial_transactions_type
  on public.financial_transactions (type);

drop trigger if exists financial_transactions_set_updated_at
  on public.financial_transactions;
create trigger financial_transactions_set_updated_at
before update on public.financial_transactions
for each row execute function public.set_updated_at();

alter table public.financial_transactions enable row level security;
revoke all on table public.financial_transactions from anon, authenticated;
grant select, insert, update, delete
  on table public.financial_transactions to anon, authenticated;

drop policy if exists "demo_finances_can_be_read"
  on public.financial_transactions;
create policy "demo_finances_can_be_read"
on public.financial_transactions for select
to anon, authenticated
using (
  exists (
    select 1
    from public.brands
    where brands.id = financial_transactions.brand_id
      and brands.user_id = '00000000-0000-0000-0000-000000000001'::uuid
  )
);

drop policy if exists "demo_finances_can_be_created"
  on public.financial_transactions;
create policy "demo_finances_can_be_created"
on public.financial_transactions for insert
to anon, authenticated
with check (
  exists (
    select 1
    from public.brands
    where brands.id = financial_transactions.brand_id
      and brands.user_id = '00000000-0000-0000-0000-000000000001'::uuid
  )
);

drop policy if exists "demo_finances_can_be_updated"
  on public.financial_transactions;
create policy "demo_finances_can_be_updated"
on public.financial_transactions for update
to anon, authenticated
using (
  exists (
    select 1
    from public.brands
    where brands.id = financial_transactions.brand_id
      and brands.user_id = '00000000-0000-0000-0000-000000000001'::uuid
  )
)
with check (
  exists (
    select 1
    from public.brands
    where brands.id = financial_transactions.brand_id
      and brands.user_id = '00000000-0000-0000-0000-000000000001'::uuid
  )
);

drop policy if exists "demo_finances_can_be_deleted"
  on public.financial_transactions;
create policy "demo_finances_can_be_deleted"
on public.financial_transactions for delete
to anon, authenticated
using (
  exists (
    select 1
    from public.brands
    where brands.id = financial_transactions.brand_id
      and brands.user_id = '00000000-0000-0000-0000-000000000001'::uuid
  )
);

insert into public.financial_transactions (
  id, brand_id, type, category, description, amount, due_date, status, paid_at
) values
  (
    '40000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'income', 'Assinaturas', 'Receita mensal dos planos PostFlow',
    3500.00, '2026-09-05', 'paid', '2026-09-05 12:00:00+00'
  ),
  (
    '40000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000001',
    'expense', 'Infraestrutura', 'Serviços de hospedagem e banco de dados',
    800.00, '2026-09-08', 'paid', '2026-09-08 15:30:00+00'
  ),
  (
    '40000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000001',
    'expense', 'Marketing', 'Campanha de divulgação do produto',
    450.00, '2026-09-20', 'pending', null
  ),
  (
    '40000000-0000-0000-0000-000000000004',
    '10000000-0000-0000-0000-000000000001',
    'income', 'Serviços', 'Consultoria de conteúdo para cliente',
    1200.00, '2026-09-25', 'pending', null
  )
on conflict (id) do update set
  type = excluded.type,
  category = excluded.category,
  description = excluded.description,
  amount = excluded.amount,
  due_date = excluded.due_date,
  status = excluded.status,
  paid_at = excluded.paid_at;

commit;
