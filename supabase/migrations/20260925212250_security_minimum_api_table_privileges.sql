-- The BFF accesses these tables with its server-side service role. Browser roles
-- retain any CRUD grants protected by RLS, but must not alter table structure.
begin;

revoke references, trigger, truncate
on table public.profiles, public.brand_members
from anon, authenticated;

commit;
