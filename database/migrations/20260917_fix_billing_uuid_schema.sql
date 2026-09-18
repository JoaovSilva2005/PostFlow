-- O Supabase instala pgcrypto no schema extensions. Como o workflow usa
-- search_path vazio, a função precisa qualificar gen_random_uuid explicitamente.
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
    'PF-' || to_char(now(), 'YYYYMMDD') || '-' || substr(extensions.gen_random_uuid()::text, 1, 8),
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

revoke all on function public.create_subscription_invoice_workflow(uuid,text,text)
  from public, anon, authenticated;
grant execute on function public.create_subscription_invoice_workflow(uuid,text,text)
  to service_role;

commit;
