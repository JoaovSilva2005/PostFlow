-- Corrige a permissão do repositório financeiro usado pelo backend.
-- A chave administrativa permanece somente no servidor.

begin;

revoke all on table public.financial_transactions from anon, authenticated;
grant select, insert, update, delete
  on table public.financial_transactions to service_role;

commit;
