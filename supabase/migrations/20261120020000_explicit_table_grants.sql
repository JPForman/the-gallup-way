-- Explicit table privileges for every public table.
--
-- The local Supabase stack grants anon/authenticated ALL on new public tables
-- by default (pg_default_acl for role postgres), but the cloud project does
-- not. Tables that relied on that default (categories, sources, images,
-- agreement versions/acceptances) were unreadable in the cloud, which broke
-- the home page build. RLS still decides which ROWS each role sees; these
-- grants only say which operations a role may attempt at all.

-- 1. Stop the local default so a missing grant fails locally too.
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;

-- 2. Grants each table's policies already assume.
grant select on public.categories to anon, authenticated;
grant select on public.agreement_versions to anon, authenticated;

revoke all on public.agreement_acceptances from anon;
grant select, insert on public.agreement_acceptances to authenticated;

revoke insert, update, delete on public.article_sources, public.article_images from anon;
grant select on public.article_sources, public.article_images to anon, authenticated;
grant insert, update, delete on public.article_sources, public.article_images to authenticated;

-- 3. Drop the TRIGGER/REFERENCES leftovers of the local default (no role needs them).
revoke trigger, references on all tables in schema public from anon, authenticated;
