-- Snapshot de uma NFS-e estritamente simulada. Os campos seguem a organização
-- visual de um DANFSe, mas não representam emissão municipal ou nacional.
begin;

alter table public.fiscal_documents
  add column if not exists document_number text,
  add column if not exists verification_code text,
  add column if not exists environment text,
  add column if not exists issuer_name text,
  add column if not exists issuer_document text,
  add column if not exists issuer_municipal_registration text,
  add column if not exists issuer_city text,
  add column if not exists recipient_name text,
  add column if not exists recipient_document text,
  add column if not exists recipient_email text,
  add column if not exists service_code text,
  add column if not exists service_description text,
  add column if not exists service_municipality text;

drop trigger if exists fiscal_documents_immutable
  on public.fiscal_documents;

update public.fiscal_documents as fiscal
   set document_number = coalesce(
         fiscal.document_number,
         'SIM-' || to_char(fiscal.issued_at, 'YYYYMMDD') || '-' ||
         upper(substr(replace(fiscal.id::text, '-', ''), 1, 8))
       ),
       verification_code = coalesce(
         fiscal.verification_code,
         upper(substr(md5(fiscal.external_reference || fiscal.id::text), 1, 16))
       ),
       environment = coalesce(fiscal.environment, 'simulation'),
       issuer_name = coalesce(
         fiscal.issuer_name,
         'PostFlow Tecnologia Ltda. — emissor simulado'
       ),
       issuer_document = coalesce(fiscal.issuer_document, '00.000.000/0001-00'),
       issuer_municipal_registration = coalesce(
         fiscal.issuer_municipal_registration,
         '00000000'
       ),
       issuer_city = coalesce(fiscal.issuer_city, 'Curitiba/PR'),
       recipient_name = coalesce(fiscal.recipient_name, brand.name),
       recipient_document = coalesce(
         fiscal.recipient_document,
         'Não informado — simulação acadêmica'
       ),
       recipient_email = coalesce(fiscal.recipient_email, account.email),
       service_code = coalesce(fiscal.service_code, '01.03'),
       service_description = coalesce(
         fiscal.service_description,
         'Licenciamento mensal de plataforma SaaS para planejamento e geração assistida de conteúdo digital.'
       ),
       service_municipality = coalesce(
         fiscal.service_municipality,
         'Curitiba/PR'
       )
  from public.brands as brand
  join public.users as account on account.id = brand.user_id
 where brand.id = fiscal.brand_id;

alter table public.fiscal_documents
  alter column environment set default 'simulation',
  alter column issuer_name set default 'PostFlow Tecnologia Ltda. — emissor simulado',
  alter column issuer_document set default '00.000.000/0001-00',
  alter column issuer_municipal_registration set default '00000000',
  alter column issuer_city set default 'Curitiba/PR',
  alter column recipient_document set default 'Não informado — simulação acadêmica',
  alter column service_code set default '01.03',
  alter column service_description set default 'Licenciamento mensal de plataforma SaaS para planejamento e geração assistida de conteúdo digital.',
  alter column service_municipality set default 'Curitiba/PR',
  alter column document_number set not null,
  alter column verification_code set not null,
  alter column environment set not null,
  alter column issuer_name set not null,
  alter column issuer_document set not null,
  alter column issuer_municipal_registration set not null,
  alter column issuer_city set not null,
  alter column recipient_name set not null,
  alter column recipient_document set not null,
  alter column recipient_email set not null,
  alter column service_code set not null,
  alter column service_description set not null,
  alter column service_municipality set not null;

alter table public.fiscal_documents
  drop constraint if exists fiscal_documents_environment_check;
alter table public.fiscal_documents
  add constraint fiscal_documents_environment_check
  check (environment in ('simulation', 'homologation', 'production'));

create or replace function public.reject_fiscal_document_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE'
    and old.status = 'issued' and new.status = 'void'
    and new.brand_id = old.brand_id
    and new.billing_invoice_id = old.billing_invoice_id
    and new.financial_transaction_id = old.financial_transaction_id
    and new.external_reference = old.external_reference
    and new.document_number = old.document_number
    and new.verification_code = old.verification_code
    and new.environment = old.environment
    and new.issuer_name = old.issuer_name
    and new.issuer_document = old.issuer_document
    and new.issuer_municipal_registration = old.issuer_municipal_registration
    and new.issuer_city = old.issuer_city
    and new.recipient_name = old.recipient_name
    and new.recipient_document = old.recipient_document
    and new.recipient_email = old.recipient_email
    and new.service_code = old.service_code
    and new.service_description = old.service_description
    and new.service_municipality = old.service_municipality
    and new.tax_rate = old.tax_rate
    and new.tax_cents = old.tax_cents
    and new.net_cents = old.net_cents
    and new.gross_cents = old.gross_cents
    and new.description = old.description
    and new.version = old.version
    and new.idempotency_key = old.idempotency_key
    and new.issued_at = old.issued_at
    and new.created_at = old.created_at then
    return new;
  end if;
  raise exception 'fiscal_document_immutable';
end;
$$;

create trigger fiscal_documents_immutable
before update or delete on public.fiscal_documents
for each row execute function public.reject_fiscal_document_mutation();

create or replace function public.pay_billing_invoice_workflow(
  p_workspace_id uuid, p_invoice_id uuid, p_idempotency_key text,
  p_payment_reference text, p_fiscal_reference text
) returns table (
  id uuid, invoice_number text, amount_cents integer, status text,
  due_date date, paid_at timestamptz, fiscal_reference text,
  tax_cents integer, net_cents integer, issued_at timestamptz
)
language plpgsql security definer set search_path = '' as $$
declare
  v_invoice public.billing_invoices%rowtype;
  v_tax integer;
  v_transaction_id uuid;
  v_recipient_name text;
  v_recipient_email text;
  v_document_number text;
  v_verification_code text;
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

  select brand.name, account.email
    into v_recipient_name, v_recipient_email
    from public.brands as brand
    join public.users as account on account.id = brand.user_id
   where brand.id = p_workspace_id;

  if not found then
    raise exception 'workspace_recipient_not_found';
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
  v_document_number := 'SIM-' || to_char(now(), 'YYYYMMDD') || '-' ||
    upper(substr(replace(v_invoice.id::text, '-', ''), 1, 8));
  v_verification_code := upper(
    substr(md5(p_fiscal_reference || v_invoice.id::text), 1, 16)
  );

  insert into public.fiscal_documents(
    brand_id, billing_invoice_id, financial_transaction_id,
    external_reference, document_number, verification_code, environment,
    issuer_name, issuer_document, issuer_municipal_registration, issuer_city,
    recipient_name, recipient_document, recipient_email,
    service_code, service_description, service_municipality,
    tax_cents, net_cents, gross_cents, description, idempotency_key
  ) values (
    p_workspace_id,
    v_invoice.id,
    v_transaction_id,
    p_fiscal_reference,
    v_document_number,
    v_verification_code,
    'simulation',
    'PostFlow Tecnologia Ltda. — emissor simulado',
    '00.000.000/0001-00',
    '00000000',
    'Curitiba/PR',
    v_recipient_name,
    'Não informado — simulação acadêmica',
    v_recipient_email,
    '01.03',
    'Licenciamento mensal de plataforma SaaS para planejamento e geração assistida de conteúdo digital.',
    'Curitiba/PR',
    v_tax,
    v_invoice.amount_cents - v_tax,
    v_invoice.amount_cents,
    'Assinatura mensal PostFlow — fatura ' || v_invoice.invoice_number,
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

revoke all on function public.pay_billing_invoice_workflow(uuid,uuid,text,text,text)
  from public, anon, authenticated;
grant execute on function public.pay_billing_invoice_workflow(uuid,uuid,text,text,text)
  to service_role;

commit;
