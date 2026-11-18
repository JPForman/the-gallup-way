-- Agreement versions and acceptances (migration 20261118220000).
begin;
select plan(30);

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  -- Full sign-up metadata, as the app sends it
  ('aaaaaaaa-0000-0000-0000-000000000001', 'carol@test.local',
   '{"handle":"carol","display_name":"Carol","age_confirmed":true,"accepted_terms_version":1,"accepted_privacy_version":1,"ip_hash":"0000000000000000000000000000000000000000000000000000000000000abc"}'),
  -- Direct API sign-up with no agreement metadata
  ('aaaaaaaa-0000-0000-0000-000000000002', 'dave@test.local', '{"handle":"dave","display_name":"Dave"}'),
  -- Stale version + malformed IP hash
  ('aaaaaaaa-0000-0000-0000-000000000003', 'erin@test.local',
   '{"handle":"erin","display_name":"Erin","age_confirmed":true,"accepted_terms_version":0,"accepted_privacy_version":1,"ip_hash":"1.2.3.4"}'),
  -- Staff
  ('aaaaaaaa-0000-0000-0000-000000000004', 'staff@test.local', '{"handle":"stella","display_name":"Stella"}');
update public.profiles set role = 'moderator' where id = 'aaaaaaaa-0000-0000-0000-000000000004';

-- ---------------------------------------------------------------------------
-- Schema and seeded versions
-- ---------------------------------------------------------------------------
select ok((select relrowsecurity from pg_class where oid = 'public.agreement_versions'::regclass),
  'RLS enabled on agreement_versions');
select ok((select relrowsecurity from pg_class where oid = 'public.agreement_acceptances'::regclass),
  'RLS enabled on agreement_acceptances');
select is(public.current_agreement_version('terms'), 1, 'terms v1 is current');
select is(public.current_agreement_version('privacy'), 1, 'privacy v1 is current');
select is(public.current_agreement_version('contributor'), 1, 'contributor v1 is current');

-- ---------------------------------------------------------------------------
-- Signup trigger
-- ---------------------------------------------------------------------------
select isnt((select age_confirmed_at from public.profiles where handle = 'carol'), null,
  '18+ attestation recorded at sign-up');
select is((select count(*)::int from public.agreement_acceptances
  where user_id = 'aaaaaaaa-0000-0000-0000-000000000001' and kind in ('terms', 'privacy')), 2,
  'terms and privacy acceptances recorded at sign-up');
select is((select ip_hash from public.agreement_acceptances
  where user_id = 'aaaaaaaa-0000-0000-0000-000000000001' and kind = 'terms'),
  '0000000000000000000000000000000000000000000000000000000000000abc', 'IP hash stored');
select is((select count(*)::int from public.agreement_acceptances
  where user_id = 'aaaaaaaa-0000-0000-0000-000000000002'), 0,
  'no acceptances without metadata');
select is((select age_confirmed_at from public.profiles where handle = 'dave'), null,
  'no 18+ attestation without metadata');
select is((select count(*)::int from public.agreement_acceptances
  where user_id = 'aaaaaaaa-0000-0000-0000-000000000003' and kind = 'terms'), 0,
  'stale terms version is not recorded');
select is((select ip_hash from public.agreement_acceptances
  where user_id = 'aaaaaaaa-0000-0000-0000-000000000003' and kind = 'privacy'), null,
  'malformed IP hash is dropped');

-- ---------------------------------------------------------------------------
-- Anonymous visitors
-- ---------------------------------------------------------------------------
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select is((select count(*)::int from public.agreement_versions), 3, 'anon can read versions');
select is((select count(*)::int from public.agreement_acceptances), 0, 'anon cannot read acceptances');
select throws_ok(
  $$insert into public.agreement_acceptances (kind, version) values ('terms', 1)$$,
  '42501', null, 'anon cannot record acceptances');

-- ---------------------------------------------------------------------------
-- Users
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}';
select ok(public.can_write(), 'fully accepted user can write');

set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-0000-0000-000000000002","role":"authenticated"}';
select ok(not public.can_write(), 'user without acceptances cannot write');
select is((select count(*)::int from public.agreement_acceptances
  where user_id <> 'aaaaaaaa-0000-0000-0000-000000000002'), 0,
  'users cannot see other users'' acceptances');

-- Dave tries to forge owner, version and timestamp; the trigger overrides them.
insert into public.agreement_acceptances (user_id, kind, version, created_at)
values ('aaaaaaaa-0000-0000-0000-000000000001', 'terms', 1, '2001-01-01');
insert into public.agreement_acceptances (kind, version) values ('privacy', 1);

select is((select count(*)::int from public.agreement_acceptances
  where user_id = 'aaaaaaaa-0000-0000-0000-000000000002'), 2,
  'forged owner is replaced with the caller');
select ok((select min(created_at) > now() - interval '1 minute' from public.agreement_acceptances
  where user_id = 'aaaaaaaa-0000-0000-0000-000000000002'),
  'forged timestamp is replaced with now()');
select ok(not public.can_write(), 'still cannot write without the 18+ attestation');
select throws_ok(
  $$update public.profiles set age_confirmed_at = now() where id = 'aaaaaaaa-0000-0000-0000-000000000002'$$,
  '42501', 'You cannot change protected profile fields', 'user cannot set their own 18+ attestation');

select throws_ok(
  $$insert into public.agreement_acceptances (kind, version) values ('contributor', 1)$$,
  '23514', null, 'contributor acceptance requires an article');
select throws_ok(
  $$update public.agreement_acceptances set version = 1$$,
  '42501', null, 'acceptances cannot be updated');
select throws_ok(
  $$delete from public.agreement_acceptances$$,
  '42501', null, 'acceptances cannot be deleted');
select throws_ok(
  $$insert into public.agreement_versions (kind, version, text_sha256)
    values ('terms', 9, repeat('a', 64))$$,
  '42501', null, 'users cannot publish agreement versions');

-- Staff can read everyone's acceptances.
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-0000-0000-000000000004","role":"authenticated"}';
select ok((select count(distinct user_id) from public.agreement_acceptances) >= 3,
  'staff can read all acceptances');

-- ---------------------------------------------------------------------------
-- New Terms version: everyone must re-accept before writing.
-- ---------------------------------------------------------------------------
reset role;
insert into public.agreement_versions (kind, version, text_sha256, effective_at)
values ('terms', 2, repeat('b', 64), now() - interval '1 second');

set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}';
select ok(not public.can_write(), 'terms bump blocks writing until re-accepted');
insert into public.agreement_acceptances (kind, version) values ('terms', 1);
select ok(public.can_write(), 're-accepting records the current version and restores writing');

-- ---------------------------------------------------------------------------
-- Account deletion anonymizes acceptance records.
-- ---------------------------------------------------------------------------
reset role;
delete from auth.users where id = 'aaaaaaaa-0000-0000-0000-000000000001';
select ok((select count(*) from public.agreement_acceptances where user_id is null) >= 3,
  'deleting the account keeps acceptances with user_id set to null');

select * from finish();
rollback;
