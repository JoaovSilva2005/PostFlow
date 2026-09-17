-- PostFlow: três contas para demonstração acadêmica.
-- Pré-requisitos:
--   1. aplicar as migrations de production_tenancy e saas_billing_authorization;
--   2. criar e confirmar no Supabase Auth os usuários abaixo;
--   3. executar este arquivo como postgres no SQL Editor.
-- As senhas pertencem somente ao Supabase Auth e nunca ficam neste repositório.

begin;

do $$
declare
  v_admin_id uuid;
  v_client_id uuid;
  v_without_plan_id uuid;
  v_invoice_id uuid;
  v_found integer;
begin
  select count(*) into v_found
  from auth.users
  where email in (
    'admin@postflow.test',
    'cliente@postflow.test',
    'semplano@postflow.test'
  );

  if v_found <> 3 then
    raise exception 'Crie e confirme as três contas do PostFlow no Auth antes de executar o seed.';
  end if;

  select id into v_admin_id
  from auth.users where email = 'admin@postflow.test';
  select id into v_client_id
  from auth.users where email = 'cliente@postflow.test';
  select id into v_without_plan_id
  from auth.users where email = 'semplano@postflow.test';

  insert into public.users(id, email, display_name)
  values
    (v_admin_id, 'admin@postflow.test', 'Administrador PostFlow'),
    (v_client_id, 'cliente@postflow.test', 'Cliente com plano'),
    (v_without_plan_id, 'semplano@postflow.test', 'Cliente sem plano')
  on conflict (id) do update set
    email = excluded.email,
    display_name = excluded.display_name;

  insert into public.profiles(id, display_name)
  values
    (v_admin_id, 'Administrador PostFlow'),
    (v_client_id, 'Cliente com plano'),
    (v_without_plan_id, 'Cliente sem plano')
  on conflict (id) do update set display_name = excluded.display_name;

  insert into public.brands(
    id, user_id, name, segment, tone_of_voice, primary_color
  ) values
    (
      '30000000-0000-4000-8000-000000000001', v_admin_id,
      'PostFlow Administração', 'Tecnologia', 'Profissional', '#79E2AE'
    ),
    (
      '30000000-0000-4000-8000-000000000002', v_client_id,
      'Aurora Conteúdo', 'Marketing', 'Próximo e confiante', '#4F46E5'
    ),
    (
      '30000000-0000-4000-8000-000000000003', v_without_plan_id,
      'Novo Cliente', 'Serviços', 'Profissional', '#2563EB'
    )
  on conflict (id) do update set
    user_id = excluded.user_id,
    name = excluded.name,
    segment = excluded.segment,
    tone_of_voice = excluded.tone_of_voice,
    primary_color = excluded.primary_color,
    updated_at = now();

  insert into public.brand_members(brand_id, user_id, role)
  values
    ('30000000-0000-4000-8000-000000000001', v_admin_id, 'owner'),
    ('30000000-0000-4000-8000-000000000002', v_client_id, 'owner'),
    ('30000000-0000-4000-8000-000000000003', v_without_plan_id, 'owner')
  on conflict (brand_id, user_id) do update set role = excluded.role;

  insert into public.platform_members(user_id, role)
  values (v_admin_id, 'platform_owner')
  on conflict (user_id) do update set
    role = excluded.role,
    updated_at = now();

  -- As duas contas de cliente nunca recebem papel administrativo.
  delete from public.platform_members
  where user_id in (v_client_id, v_without_plan_id);

  -- O cliente com plano recebe uma assinatura e uma fatura paga por meio dos
  -- mesmos workflows idempotentes usados pela API.
  perform public.claim_billing_operation(
    '30000000-0000-4000-8000-000000000002',
    'subscription',
    'seed-client-professional'
  );

  select workflow.id into v_invoice_id
  from public.create_subscription_invoice_workflow(
    '30000000-0000-4000-8000-000000000002',
    'professional',
    'seed-client-professional'
  ) as workflow;

  perform public.claim_billing_operation(
    '30000000-0000-4000-8000-000000000002',
    'invoice_payment',
    'invoice:' || v_invoice_id::text
  );

  perform public.pay_billing_invoice_workflow(
    '30000000-0000-4000-8000-000000000002',
    v_invoice_id,
    'invoice:' || v_invoice_id::text,
    'demo-payment-seed',
    'PF-DEMO-SEED-' || substr(v_invoice_id::text, 1, 8)
  );

  insert into public.usage_counters(
    brand_id, period_start, text_used, image_used
  ) values (
    '30000000-0000-4000-8000-000000000002',
    date_trunc('month', current_date)::date,
    18,
    4
  )
  on conflict (brand_id, period_start) do update set
    text_used = excluded.text_used,
    image_used = excluded.image_used,
    updated_at = now();

  -- A terceira conta permanece propositalmente sem plano ou fatura.
  if exists (
    select 1 from public.subscriptions
    where brand_id = '30000000-0000-4000-8000-000000000003'
  ) then
    raise exception 'O workspace sem plano já possui assinatura; revise os dados antes de continuar.';
  end if;
end $$;

commit;
