-- O service_role ignora RLS, mas ainda precisa de privilégios SQL nas tabelas.
-- Somente o BFF usa essa role; anon e authenticated continuam sem acesso aos
-- dados de negócio após o cutover.
begin;

grant select, insert, update, delete
  on public.users,
     public.brands,
     public.post_drafts,
     public.post_hashtags,
     public.financial_transactions,
     public.profiles,
     public.brand_members
  to service_role;

revoke all
  on public.users,
     public.brands,
     public.post_drafts,
     public.post_hashtags,
     public.financial_transactions
  from anon, authenticated;

commit;
