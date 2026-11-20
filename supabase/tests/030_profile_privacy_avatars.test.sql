-- Profile column privacy, my_account(), avatars storage (migration 20261119000000).
begin;
select plan(22);

insert into auth.users (id, email, raw_user_meta_data) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'pat@test.local',
   '{"handle":"pat","display_name":"Pat","age_confirmed":true,"accepted_terms_version":2,"accepted_privacy_version":2}'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'quinn@test.local', '{"handle":"quinn","display_name":"Quinn"}');
update public.profiles set suspended_until = now() + interval '1 day'
  where id = 'bbbbbbbb-0000-0000-0000-000000000002';

-- ---------------------------------------------------------------------------
-- Column privacy
-- ---------------------------------------------------------------------------
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select lives_ok(
  $$select id, handle, display_name, bio, avatar_path, role, created_at from public.profiles$$,
  'anon can read byline columns');
select throws_ok($$select age_confirmed_at from public.profiles$$, '42501', null,
  'anon cannot read age attestation');
select throws_ok($$select suspended_until from public.profiles$$, '42501', null,
  'anon cannot read suspensions');
select throws_ok($$select approved_article_count from public.profiles$$, '42501', null,
  'anon cannot read approval counts');
select throws_ok($$select * from public.profiles$$, '42501', null,
  'select * is not allowed (explicit columns only)');
select throws_ok($$select * from public.my_account()$$, '42501', null,
  'anon cannot call my_account()');

set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-0000-0000-000000000001","role":"authenticated"}';
select throws_ok($$select suspended_until from public.profiles$$, '42501', null,
  'users cannot read suspensions directly either');
select throws_ok(
  $$update public.profiles set role = 'admin' where id = 'bbbbbbbb-0000-0000-0000-000000000001'$$,
  '42501', null, 'role is not an updatable column');

-- ---------------------------------------------------------------------------
-- my_account()
-- ---------------------------------------------------------------------------
select is((select handle from public.my_account()), 'pat', 'my_account returns the caller');
select is((select count(*)::int from public.my_account()), 1, 'my_account returns one row');
select ok((select can_write and not needs_terms and not needs_privacy from public.my_account()),
  'accepted user: can write, nothing to re-accept');

set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}';
select ok((select suspended_until is not null and needs_terms and not can_write from public.my_account()),
  'suspended user without acceptances: sees suspension and re-accept flags');

-- ---------------------------------------------------------------------------
-- Avatar path constraint
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-0000-0000-000000000001","role":"authenticated"}';
select lives_ok(
  $$update public.profiles set avatar_path = 'bbbbbbbb-0000-0000-0000-000000000001/a1b2.webp'
    where id = 'bbbbbbbb-0000-0000-0000-000000000001'$$,
  'avatar in own folder is accepted');
select throws_ok(
  $$update public.profiles set avatar_path = 'bbbbbbbb-0000-0000-0000-000000000002/a1b2.webp'
    where id = 'bbbbbbbb-0000-0000-0000-000000000001'$$,
  '23514', null, 'avatar pointing at another user''s folder is rejected');
select throws_ok(
  $$update public.profiles set avatar_path = 'bbbbbbbb-0000-0000-0000-000000000001/../x.png'
    where id = 'bbbbbbbb-0000-0000-0000-000000000001'$$,
  '23514', null, 'non-webp or path-traversal avatar is rejected');

-- ---------------------------------------------------------------------------
-- Storage policies
-- ---------------------------------------------------------------------------
select lives_ok(
  $$insert into storage.objects (bucket_id, name, owner_id)
    values ('avatars', 'bbbbbbbb-0000-0000-0000-000000000001/one.webp', 'bbbbbbbb-0000-0000-0000-000000000001')$$,
  'user can upload to their own avatar folder');
select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner_id)
    values ('avatars', 'bbbbbbbb-0000-0000-0000-000000000002/evil.webp', 'bbbbbbbb-0000-0000-0000-000000000001')$$,
  '42501', null, 'user cannot upload into someone else''s folder');

set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}';
select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner_id)
    values ('avatars', 'bbbbbbbb-0000-0000-0000-000000000002/sus.webp', 'bbbbbbbb-0000-0000-0000-000000000002')$$,
  '42501', null, 'suspended user cannot upload avatars');
select is((select count(*)::int from storage.objects where bucket_id = 'avatars'), 0,
  'users cannot list other users'' avatar files');
delete from storage.objects where name = 'bbbbbbbb-0000-0000-0000-000000000001/one.webp';

reset role;
select is((select count(*)::int from storage.objects
  where name = 'bbbbbbbb-0000-0000-0000-000000000001/one.webp'), 1,
  'users cannot delete other users'' avatar files');

select is((select public from storage.buckets where id = 'avatars'), true, 'avatars bucket is public-read');

-- ---------------------------------------------------------------------------
-- Defense in depth: even if a future migration grants the column by mistake,
-- the guard trigger still blocks clients.
-- ---------------------------------------------------------------------------
grant update (role) on public.profiles to authenticated;
set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-0000-0000-000000000001","role":"authenticated"}';
select throws_ok(
  $$update public.profiles set role = 'admin' where id = 'bbbbbbbb-0000-0000-0000-000000000001'$$,
  '42501', 'You cannot change protected profile fields',
  'guard trigger blocks role changes even with a column grant');

select * from finish();
rollback;
