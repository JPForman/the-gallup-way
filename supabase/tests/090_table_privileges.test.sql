-- Exact table privileges for anon and authenticated (migration 20261120020000).
-- The cloud project has no default grants, so every table needs explicit ones.
-- Adding a public table? Add its row here: this test fails until you do.
begin;
select plan(3);

create temp table expected (tbl text, anon text, authed text);
insert into expected values
  -- S = select, I = insert, U = update, D = delete (any column counts)
  ('agreement_acceptances', '----', 'SI--'),
  ('agreement_versions',    'S---', 'S---'),
  ('article_images',        'S---', 'SIUD'),
  ('article_revisions',     '----', 'S---'),
  ('article_sources',       'S---', 'SIUD'),
  ('article_views',         'S---', 'S---'),
  ('articles',              'S---', 'SIUD'),
  ('categories',            'S---', 'S---'),
  ('comments',              'S---', 'SI--'),
  ('corrections',           'S---', 'SI--'),
  ('follows',               'S---', 'SI-D'),
  ('bookmarks',             '----', 'SI-D'),
  ('profiles',              'S---', 'S-U-'),
  ('reactions',             '----', 'SI-D');

create function pg_temp.privs(r text, t text) returns text language sql as $$
  select
    (case when has_any_column_privilege(r, 'public.' || t, 'SELECT') then 'S' else '-' end)
    || (case when has_any_column_privilege(r, 'public.' || t, 'INSERT') then 'I' else '-' end)
    || (case when has_any_column_privilege(r, 'public.' || t, 'UPDATE') then 'U' else '-' end)
    || (case when has_table_privilege(r, 'public.' || t, 'DELETE') then 'D' else '-' end);
$$;

select set_eq(
  $$select tablename::text from pg_tables where schemaname = 'public'$$,
  $$select tbl from expected$$,
  'every public table has an expected-privileges row');

select results_eq(
  $$select tbl, pg_temp.privs('anon', tbl), pg_temp.privs('authenticated', tbl) from expected order by tbl$$,
  $$select tbl, anon, authed from expected order by tbl$$,
  'anon and authenticated have exactly the expected table privileges');

-- New tables get no privileges by default (same as the cloud project).
create table public.zz_privilege_probe (id int);
select is(pg_temp.privs('anon', 'zz_privilege_probe') || pg_temp.privs('authenticated', 'zz_privilege_probe'),
  '--------', 'new tables have no default grants for anon/authenticated');

select * from finish();
rollback;
