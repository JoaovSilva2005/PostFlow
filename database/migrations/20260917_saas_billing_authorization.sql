-- Evolução não destrutiva: brands continuam sendo os workspaces do PostFlow.
-- Aplicar após 20260917_production_tenancy.sql, primeiro em homologação.
begin;

create table if not exists public.platform_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('platform_owner', 'finance_admin', 'support')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9_-]{2,64}$'),
  name text not null check (length(trim(name)) >= 2),
  price_cents integer not null check (price_cents > 0),
  text_limit integer not null check (text_limit >= 0),
  image_limit integer not null check (image_limit >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.plans(code, name, price_cents, text_limit, image_limit, active)
values ('professional', 'Profissional', 7990, 100, 30, true)
on conflict (code) do update set
  name = excluded.name,
  price_cents = excluded.price_cents,
  text_limit = excluded.text_limit,
  image_limit = excluded.image_limit,
  active = excluded.active,
  updated_at = now();

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  plan_id uuid not null references public.plans(id) on delete restrict,
  status text not null default 'active' check (status in ('trialing', 'active', 'past_due', 'cancelled')),
  current_period_start date not null,
  current_period_end date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (current_period_end > current_period_start)
);
create unique index if not exists subscriptions_one_active_per_brand
  on public.subscriptions(brand_id) where status in ('trialing', 'active', 'past_due');

create table if not exists public.usage_counters (
  brand_id uuid not null references public.brands(id) on delete cascade,
  period_start date not null,
  text_used integer not null default 0 check (text_used >= 0),
  image_used integer not null default 0 check (image_used >= 0),
  updated_at timestamptz not null default now(),
  primary key (brand_id, period_start)
);

create table if not exists public.billing_invoices (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete restrict,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  invoice_number text not null unique,
  amount_cents integer not null check (amount_cents > 0),
  status text not null default 'pending' check (status in ('pending', 'paid', 'void')),
  due_date date not null,
  paid_at timestamptz,
  idempotency_key text not null,
  payment_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'paid' and paid_at is not null) or (status in ('pending', 'void') and paid_at is null)),
  unique (brand_id, idempotency_key)
);
alter table public.billing_invoices add constraint billing_invoices_id_brand_unique unique (id, brand_id);

create table if not exists public.billing_operation_claims (
  brand_id uuid not null references public.brands(id) on delete cascade,
  operation text not null check (operation in ('subscription', 'invoice_payment')),
  idempotency_key text not null,
  status text not null default 'processing' check (status in ('processing', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (brand_id, operation, idempotency_key)
);

alter table public.financial_transactions
  add column if not exists billing_invoice_id uuid references public.billing_invoices(id) on delete set null,
  add column if not exists source_type text not null default 'manual'
    check (source_type in ('manual', 'sale_service', 'subscription_revenue')),
  add column if not exists idempotency_key text;
create unique index if not exists financial_transactions_invoice_unique
  on public.financial_transactions(billing_invoice_id) where billing_invoice_id is not null;
create unique index if not exists financial_transactions_idempotency_unique
  on public.financial_transactions(brand_id, idempotency_key) where idempotency_key is not null;
alter table public.financial_transactions add constraint financial_transactions_id_brand_unique unique (id, brand_id);
alter table public.financial_transactions add constraint financial_transactions_invoice_brand_fkey
  foreign key (billing_invoice_id, brand_id) references public.billing_invoices(id, brand_id);

create table if not exists public.fiscal_documents (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete restrict,
  billing_invoice_id uuid unique references public.billing_invoices(id) on delete restrict,
  financial_transaction_id uuid unique references public.financial_transactions(id) on delete restrict,
  status text not null default 'issued' check (status in ('issued', 'void')),
  external_reference text not null unique,
  tax_rate numeric(5,4) not null default 0.0600 check (tax_rate >= 0 and tax_rate <= 1),
  tax_cents integer not null check (tax_cents >= 0),
  net_cents integer not null check (net_cents >= 0),
  gross_cents integer not null check (gross_cents > 0),
  description text not null check (length(trim(description)) >= 3),
  version integer not null default 1 check (version = 1),
  issued_at timestamptz not null default now(),
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique (brand_id, idempotency_key)
);
alter table public.fiscal_documents add constraint fiscal_documents_invoice_brand_fkey
  foreign key (billing_invoice_id, brand_id) references public.billing_invoices(id, brand_id);
alter table public.fiscal_documents add constraint fiscal_documents_transaction_brand_fkey
  foreign key (financial_transaction_id, brand_id) references public.financial_transactions(id, brand_id);

create index if not exists billing_invoices_brand_id on public.billing_invoices(brand_id, created_at desc);
create index if not exists fiscal_documents_brand_id on public.fiscal_documents(brand_id, issued_at desc);
create index if not exists usage_counters_brand_id on public.usage_counters(brand_id, period_start desc);

alter table public.platform_members enable row level security;
alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.usage_counters enable row level security;
alter table public.billing_invoices enable row level security;
alter table public.fiscal_documents enable row level security;
alter table public.billing_operation_claims enable row level security;
revoke all on public.platform_members, public.plans, public.subscriptions, public.usage_counters, public.billing_invoices, public.fiscal_documents, public.billing_operation_claims from anon, authenticated;
grant select, insert, update, delete on public.platform_members, public.plans, public.subscriptions, public.usage_counters, public.billing_invoices, public.billing_operation_claims to service_role;
grant select, insert on public.fiscal_documents to service_role;
revoke update, delete on public.fiscal_documents from service_role;

create or replace function public.reject_fiscal_document_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE'
    and old.status = 'issued' and new.status = 'void'
    and new.brand_id = old.brand_id and new.billing_invoice_id = old.billing_invoice_id
    and new.financial_transaction_id = old.financial_transaction_id
    and new.external_reference = old.external_reference and new.tax_rate = old.tax_rate
    and new.tax_cents = old.tax_cents and new.net_cents = old.net_cents
    and new.gross_cents = old.gross_cents and new.description = old.description
    and new.version = old.version and new.idempotency_key = old.idempotency_key
    and new.issued_at = old.issued_at and new.created_at = old.created_at then return new;
  end if;
  raise exception 'fiscal_document_immutable';
end; $$;
drop trigger if exists fiscal_documents_immutable on public.fiscal_documents;
create trigger fiscal_documents_immutable before update or delete on public.fiscal_documents
for each row execute function public.reject_fiscal_document_mutation();

drop policy if exists workspace_member_financial_transactions on public.financial_transactions;
create policy workspace_member_financial_transactions on public.financial_transactions
for select to authenticated using (exists (select 1 from public.brand_members m where m.brand_id = financial_transactions.brand_id and m.user_id = auth.uid()));

-- Cutover: o navegador não acessa mais dados de negócio diretamente. O BFF
-- valida membership/platform role e usa service_role no servidor. Revogar os
-- grants elimina as políticas acadêmicas por UUID que ainda existam no schema.
revoke all on public.users, public.brands, public.post_drafts,
  public.post_hashtags, public.financial_transactions
  from anon, authenticated;
drop policy if exists "demo_user_can_be_read" on public.users;
drop policy if exists "demo_brand_can_be_read" on public.brands;
drop policy if exists "demo_brand_can_be_created" on public.brands;
drop policy if exists "demo_brand_can_be_updated" on public.brands;
drop policy if exists "demo_posts_can_be_read" on public.post_drafts;
drop policy if exists "demo_posts_can_be_created" on public.post_drafts;
drop policy if exists "demo_posts_can_be_updated" on public.post_drafts;
drop policy if exists "demo_posts_can_be_deleted" on public.post_drafts;
drop policy if exists "demo_hashtags_can_be_read" on public.post_hashtags;
drop policy if exists "demo_hashtags_can_be_created" on public.post_hashtags;
drop policy if exists "demo_hashtags_can_be_updated" on public.post_hashtags;
drop policy if exists "demo_hashtags_can_be_deleted" on public.post_hashtags;
drop policy if exists "demo_finances_can_be_read" on public.financial_transactions;
drop policy if exists "demo_finances_can_be_created" on public.financial_transactions;
drop policy if exists "demo_finances_can_be_updated" on public.financial_transactions;
drop policy if exists "demo_finances_can_be_deleted" on public.financial_transactions;

-- Despesas internas não pertencem necessariamente a um cliente. Receitas de
-- assinatura continuam vinculadas a billing_invoice_id/brand_id.
alter table public.financial_transactions alter column brand_id drop not null;

-- O BFF chama estas funções com service_role após autorizar membership. A função
-- mantém a cadeia assinatura -> fatura -> receita -> fiscal atomicamente.
create or replace function public.create_subscription_invoice_workflow(
  p_workspace_id uuid, p_plan_code text, p_idempotency_key text,
  p_payment_reference text, p_fiscal_reference text
) returns table (id uuid, invoice_number text, amount_cents integer, status text, due_date date, paid_at timestamptz, fiscal_reference text, tax_cents integer, net_cents integer, issued_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare v_plan public.plans%rowtype; v_subscription_id uuid; v_invoice public.billing_invoices%rowtype; v_transaction_id uuid; v_tax integer;
begin
  select * into v_invoice from public.billing_invoices where brand_id = p_workspace_id and idempotency_key = p_idempotency_key;
  if found then return query select v_invoice.id, v_invoice.invoice_number, v_invoice.amount_cents, v_invoice.status, v_invoice.due_date, v_invoice.paid_at, f.external_reference, f.tax_cents, f.net_cents, f.issued_at from public.fiscal_documents f where f.billing_invoice_id = v_invoice.id; return; end if;
  select * into v_plan from public.plans where code = p_plan_code and active;
  if not found then raise exception 'plan_not_found'; end if;
  update public.subscriptions set status = 'cancelled', updated_at = now() where brand_id = p_workspace_id and status in ('trialing','active','past_due');
  insert into public.subscriptions(brand_id,plan_id,status,current_period_start,current_period_end) values(p_workspace_id,v_plan.id,'active',current_date,current_date + 30) returning id into v_subscription_id;
  insert into public.billing_invoices(brand_id,subscription_id,invoice_number,amount_cents,status,due_date,paid_at,idempotency_key,payment_reference) values(p_workspace_id,v_subscription_id,'PF-' || to_char(now(),'YYYYMMDD') || '-' || substr(public.gen_random_uuid()::text,1,8),v_plan.price_cents,'paid',current_date,now(),p_idempotency_key,p_payment_reference) returning * into v_invoice;
  insert into public.financial_transactions(brand_id,type,category,description,amount,due_date,status,paid_at,billing_invoice_id,source_type,idempotency_key) values(p_workspace_id,'income','Assinaturas','Assinatura ' || v_plan.name,v_plan.price_cents / 100.0,current_date,'paid',now(),v_invoice.id,'subscription_revenue',p_idempotency_key) returning id into v_transaction_id;
  v_tax := round(v_plan.price_cents * 0.06);
  insert into public.fiscal_documents(brand_id,billing_invoice_id,financial_transaction_id,external_reference,tax_cents,net_cents,gross_cents,description,idempotency_key) values(p_workspace_id,v_invoice.id,v_transaction_id,p_fiscal_reference,v_tax,v_plan.price_cents-v_tax,v_plan.price_cents,'Assinatura ' || v_plan.name,p_idempotency_key);
  update public.billing_operation_claims set status='completed',updated_at=now() where brand_id=p_workspace_id and operation='subscription' and idempotency_key=p_idempotency_key;
  return query select v_invoice.id,v_invoice.invoice_number,v_invoice.amount_cents,v_invoice.status,v_invoice.due_date,v_invoice.paid_at,p_fiscal_reference,v_tax,v_plan.price_cents-v_tax,now();
end; $$;

create or replace function public.pay_billing_invoice_workflow(
  p_workspace_id uuid, p_invoice_id uuid, p_idempotency_key text,
  p_payment_reference text, p_fiscal_reference text
) returns table (id uuid, invoice_number text, amount_cents integer, status text, due_date date, paid_at timestamptz, fiscal_reference text, tax_cents integer, net_cents integer, issued_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare v_invoice public.billing_invoices%rowtype; v_tax integer; v_transaction_id uuid;
begin
  select * into v_invoice from public.billing_invoices where id=p_invoice_id and brand_id=p_workspace_id for update;
  if not found then raise exception 'invoice_not_found'; end if;
  if v_invoice.status = 'paid' then return query select v_invoice.id,v_invoice.invoice_number,v_invoice.amount_cents,v_invoice.status,v_invoice.due_date,v_invoice.paid_at,f.external_reference,f.tax_cents,f.net_cents,f.issued_at from public.fiscal_documents f where f.billing_invoice_id=v_invoice.id; return; end if;
  update public.billing_invoices set status='paid',paid_at=now(),payment_reference=p_payment_reference,updated_at=now() where id=v_invoice.id returning * into v_invoice;
  insert into public.financial_transactions(brand_id,type,category,description,amount,due_date,status,paid_at,billing_invoice_id,source_type,idempotency_key) values(p_workspace_id,'income','Assinaturas','Pagamento de fatura ' || v_invoice.invoice_number,v_invoice.amount_cents / 100.0,current_date,'paid',now(),v_invoice.id,'subscription_revenue',p_idempotency_key) returning id into v_transaction_id;
  v_tax := round(v_invoice.amount_cents * 0.06);
  insert into public.fiscal_documents(brand_id,billing_invoice_id,financial_transaction_id,external_reference,tax_cents,net_cents,gross_cents,description,idempotency_key) values(p_workspace_id,v_invoice.id,v_transaction_id,p_fiscal_reference,v_tax,v_invoice.amount_cents-v_tax,v_invoice.amount_cents,'Pagamento de fatura ' || v_invoice.invoice_number,p_idempotency_key) on conflict (billing_invoice_id) do nothing;
  update public.billing_operation_claims set status='completed',updated_at=now() where brand_id=p_workspace_id and operation='invoice_payment' and idempotency_key=p_idempotency_key;
  return query select v_invoice.id,v_invoice.invoice_number,v_invoice.amount_cents,v_invoice.status,v_invoice.due_date,v_invoice.paid_at,p_fiscal_reference,v_tax,v_invoice.amount_cents-v_tax,now();
end; $$;

create or replace function public.claim_billing_operation(
  p_workspace_id uuid, p_operation text, p_idempotency_key text
) returns text language plpgsql security definer set search_path = '' as $$
declare v_status text;
begin
  insert into public.billing_operation_claims(brand_id,operation,idempotency_key) values(p_workspace_id,p_operation,p_idempotency_key) on conflict do nothing;
  if found then return 'claimed'; end if;
  select status into v_status from public.billing_operation_claims where brand_id=p_workspace_id and operation=p_operation and idempotency_key=p_idempotency_key;
  return coalesce(v_status, 'processing');
end; $$;

revoke all on function public.create_subscription_invoice_workflow(uuid,text,text,text,text) from public, anon, authenticated;
revoke all on function public.pay_billing_invoice_workflow(uuid,uuid,text,text,text) from public, anon, authenticated;
revoke all on function public.claim_billing_operation(uuid,text,text) from public, anon, authenticated;
grant execute on function public.create_subscription_invoice_workflow(uuid,text,text,text,text) to service_role;
grant execute on function public.pay_billing_invoice_workflow(uuid,uuid,text,text,text) to service_role;
grant execute on function public.claim_billing_operation(uuid,text,text) to service_role;
commit;
