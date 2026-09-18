-- Corrige referências ambíguas criadas pelos nomes das colunas de retorno
-- das funções RETURNS TABLE. Esta migration deve ser aplicada depois de
-- 20260917_saas_billing_authorization.sql.
begin;

create or replace function public.create_subscription_invoice_workflow(
  p_workspace_id uuid, p_plan_code text, p_idempotency_key text
) returns table (id uuid, invoice_number text, amount_cents integer, status text, due_date date, paid_at timestamptz, fiscal_reference text, tax_cents integer, net_cents integer, issued_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  v_plan public.plans%rowtype;
  v_subscription_id uuid;
  v_invoice public.billing_invoices%rowtype;
begin
  select invoice.*
    into v_invoice
    from public.billing_invoices as invoice
   where invoice.brand_id = p_workspace_id
     and invoice.idempotency_key = p_idempotency_key;

  if found then
    return query
      select v_invoice.id,
             v_invoice.invoice_number,
             v_invoice.amount_cents,
             v_invoice.status,
             v_invoice.due_date,
             v_invoice.paid_at,
             fiscal.external_reference,
             fiscal.tax_cents,
             fiscal.net_cents,
             fiscal.issued_at
        from (select 1) as seed
        left join public.fiscal_documents as fiscal
          on fiscal.billing_invoice_id = v_invoice.id;
    return;
  end if;

  select plan.*
    into v_plan
    from public.plans as plan
   where plan.code = p_plan_code
     and plan.active;

  if not found then
    raise exception 'plan_not_found';
  end if;

  update public.subscriptions as subscription
     set status = 'cancelled', updated_at = now()
   where subscription.brand_id = p_workspace_id
     and subscription.status in ('trialing', 'active', 'past_due');

  insert into public.subscriptions(
    brand_id, plan_id, status, current_period_start, current_period_end
  ) values (
    p_workspace_id, v_plan.id, 'past_due', current_date, current_date + 30
  ) returning subscriptions.id into v_subscription_id;

  insert into public.billing_invoices(
    brand_id, subscription_id, invoice_number, amount_cents, status,
    due_date, paid_at, idempotency_key
  ) values (
    p_workspace_id,
    v_subscription_id,
    'PF-' || to_char(now(), 'YYYYMMDD') || '-' || substr(public.gen_random_uuid()::text, 1, 8),
    v_plan.price_cents,
    'pending',
    current_date + 7,
    null,
    p_idempotency_key
  ) returning * into v_invoice;

  update public.billing_operation_claims as claim
     set status = 'completed', updated_at = now()
   where claim.brand_id = p_workspace_id
     and claim.operation = 'subscription'
     and claim.idempotency_key = p_idempotency_key;

  return query
    select v_invoice.id,
           v_invoice.invoice_number,
           v_invoice.amount_cents,
           v_invoice.status,
           v_invoice.due_date,
           v_invoice.paid_at,
           null::text,
           null::integer,
           null::integer,
           null::timestamptz;
end;
$$;

create or replace function public.pay_billing_invoice_workflow(
  p_workspace_id uuid, p_invoice_id uuid, p_idempotency_key text,
  p_payment_reference text, p_fiscal_reference text
) returns table (id uuid, invoice_number text, amount_cents integer, status text, due_date date, paid_at timestamptz, fiscal_reference text, tax_cents integer, net_cents integer, issued_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  v_invoice public.billing_invoices%rowtype;
  v_tax integer;
  v_transaction_id uuid;
begin
  select invoice.*
    into v_invoice
    from public.billing_invoices as invoice
   where invoice.id = p_invoice_id
     and invoice.brand_id = p_workspace_id
   for update;

  if not found then
    raise exception 'invoice_not_found';
  end if;

  if v_invoice.status = 'paid' then
    return query
      select v_invoice.id,
             v_invoice.invoice_number,
             v_invoice.amount_cents,
             v_invoice.status,
             v_invoice.due_date,
             v_invoice.paid_at,
             fiscal.external_reference,
             fiscal.tax_cents,
             fiscal.net_cents,
             fiscal.issued_at
        from public.fiscal_documents as fiscal
       where fiscal.billing_invoice_id = v_invoice.id;
    return;
  end if;

  update public.billing_invoices as invoice
     set status = 'paid',
         paid_at = now(),
         payment_reference = p_payment_reference,
         updated_at = now()
   where invoice.id = v_invoice.id
  returning invoice.* into v_invoice;

  update public.subscriptions as subscription
     set status = 'active', updated_at = now()
   where subscription.id = v_invoice.subscription_id;

  insert into public.financial_transactions(
    brand_id, type, category, description, amount, due_date, status, paid_at,
    billing_invoice_id, source_type, idempotency_key
  ) values (
    p_workspace_id,
    'income',
    'Assinaturas',
    'Pagamento de fatura ' || v_invoice.invoice_number,
    v_invoice.amount_cents / 100.0,
    current_date,
    'paid',
    now(),
    v_invoice.id,
    'subscription_revenue',
    p_idempotency_key
  ) returning financial_transactions.id into v_transaction_id;

  v_tax := round(v_invoice.amount_cents * 0.06);

  insert into public.fiscal_documents(
    brand_id, billing_invoice_id, financial_transaction_id,
    external_reference, tax_cents, net_cents, gross_cents,
    description, idempotency_key
  ) values (
    p_workspace_id,
    v_invoice.id,
    v_transaction_id,
    p_fiscal_reference,
    v_tax,
    v_invoice.amount_cents - v_tax,
    v_invoice.amount_cents,
    'Pagamento de fatura ' || v_invoice.invoice_number,
    p_idempotency_key
  ) on conflict (billing_invoice_id) do nothing;

  update public.billing_operation_claims as claim
     set status = 'completed', updated_at = now()
   where claim.brand_id = p_workspace_id
     and claim.operation = 'invoice_payment'
     and claim.idempotency_key = p_idempotency_key;

  return query
    select v_invoice.id,
           v_invoice.invoice_number,
           v_invoice.amount_cents,
           v_invoice.status,
           v_invoice.due_date,
           v_invoice.paid_at,
           p_fiscal_reference,
           v_tax,
           v_invoice.amount_cents - v_tax,
           now();
end;
$$;

revoke all on function public.create_subscription_invoice_workflow(uuid,text,text)
  from public, anon, authenticated;
revoke all on function public.pay_billing_invoice_workflow(uuid,uuid,text,text,text)
  from public, anon, authenticated;
grant execute on function public.create_subscription_invoice_workflow(uuid,text,text)
  to service_role;
grant execute on function public.pay_billing_invoice_workflow(uuid,uuid,text,text,text)
  to service_role;

commit;
