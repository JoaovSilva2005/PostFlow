-- O catálogo de plataformas é lido somente pelo BFF para montar os rascunhos.
-- Mantemos o acesso direto do navegador revogado e concedemos o mínimo ao
-- service_role usado exclusivamente no backend.
begin;

grant select on public.social_platforms to service_role;
revoke all on public.social_platforms from anon, authenticated;

commit;
