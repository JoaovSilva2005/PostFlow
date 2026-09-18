-- Ajustes apontados pelos advisors do Supabase após o cutover para o BFF.
begin;

-- A função é utilizada pelo event trigger interno e não deve ficar exposta
-- como RPC para usuários anônimos ou autenticados.
revoke execute on function public.rls_auto_enable()
  from public, anon, authenticated;

drop policy if exists "profile_owner_access" on public.profiles;
create policy "profile_owner_access" on public.profiles
for all to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

drop policy if exists "member_can_read_membership" on public.brand_members;
create policy "member_can_read_membership" on public.brand_members
for select to authenticated
using (user_id = (select auth.uid()));

drop policy if exists workspace_member_financial_transactions
  on public.financial_transactions;
create policy workspace_member_financial_transactions
on public.financial_transactions
for select to authenticated
using (
  exists (
    select 1
      from public.brand_members as membership
     where membership.brand_id = financial_transactions.brand_id
       and membership.user_id = (select auth.uid())
  )
);

create index if not exists billing_invoices_subscription_id_idx
  on public.billing_invoices(subscription_id);
create index if not exists subscriptions_plan_id_idx
  on public.subscriptions(plan_id);
create index if not exists financial_transactions_invoice_brand_idx
  on public.financial_transactions(billing_invoice_id, brand_id);
create index if not exists fiscal_documents_invoice_brand_idx
  on public.fiscal_documents(billing_invoice_id, brand_id);
create index if not exists fiscal_documents_transaction_brand_idx
  on public.fiscal_documents(financial_transaction_id, brand_id);

commit;
