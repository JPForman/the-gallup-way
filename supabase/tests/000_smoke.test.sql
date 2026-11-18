-- Smoke test: the test harness runs and the public schema exists.
begin;
select plan(2);

select has_schema('public');
select has_extension('pgtap');

select * from finish();
rollback;
