-- Profiles, roles and authorization helpers (migration 20261118210000).
begin;
select plan(32);

-- ---------------------------------------------------------------------------
-- Fixtures: create auth users as postgres; the signup trigger makes profiles.
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'alice@test.local', '{"handle":"alice","display_name":"Alice Adams"}'),
  ('22222222-2222-2222-2222-222222222222', 'bob@test.local',   '{"handle":"bob","display_name":"Bob Brown"}'),
  ('33333333-3333-3333-3333-333333333333', 'mod@test.local',   '{"handle":"maria","display_name":"Maria Mod"}'),
  ('44444444-4444-4444-4444-444444444444', 'admin@test.local', '{"handle":"ana","display_name":"Ana Admin"}'),
  -- Taken handle -> fallback
  ('55555555-5555-5555-5555-555555555555', 'dup@test.local',   '{"handle":"alice","display_name":"Second Alice"}'),
  -- Reserved handle + missing display name -> fallback for both
  ('66666666-6666-6666-6666-666666666666', 'res@test.local',   '{"handle":"admin"}'),
  -- Suspended user
  ('77777777-7777-7777-7777-777777777777', 'sus@test.local',   '{"handle":"sam","display_name":"Sam Suspended"}');

update public.profiles set role = 'moderator' where id = '33333333-3333-3333-3333-333333333333';
update public.profiles set role = 'admin'     where id = '44444444-4444-4444-4444-444444444444';
update public.profiles set suspended_until = now() + interval '7 days'
  where id = '77777777-7777-7777-7777-777777777777';

-- ---------------------------------------------------------------------------
-- Schema
-- ---------------------------------------------------------------------------
select has_table('public', 'profiles', 'profiles table exists');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.profiles'::regclass),
  'RLS is enabled on profiles'
);

-- ---------------------------------------------------------------------------
-- Signup trigger
-- ---------------------------------------------------------------------------
select is(
  (select handle from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  'alice', 'signup trigger uses the requested handle'
);
select is(
  (select display_name from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  'Alice Adams', 'signup trigger uses the requested display name'
);
select is(
  (select handle from public.profiles where id = '55555555-5555-5555-5555-555555555555'),
  'user_555555555555', 'taken handle falls back to user_<id>'
);
select is(
  (select handle from public.profiles where id = '66666666-6666-6666-6666-666666666666'),
  'user_666666666666', 'reserved handle falls back to user_<id>'
);
select is(
  (select display_name from public.profiles where id = '66666666-6666-6666-6666-666666666666'),
  'user_666666666666', 'missing display name falls back to the handle'
);
select is(
  (select role::text from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  'user', 'new users get the user role'
);

-- ---------------------------------------------------------------------------
-- Handle validation
-- ---------------------------------------------------------------------------
select ok(public.is_valid_handle('gallup_fan_87'), 'valid handle accepted');
select ok(not public.is_valid_handle('ab'), 'too-short handle rejected');
select ok(not public.is_valid_handle('Has Caps'), 'uppercase/space handle rejected');
select ok(not public.is_valid_handle('moderator'), 'reserved handle rejected');
select throws_ok(
  $$update public.profiles set handle = 'Bad Handle!' where id = '22222222-2222-2222-2222-222222222222'$$,
  '23514', null, 'check constraint blocks invalid handles'
);

-- ---------------------------------------------------------------------------
-- Anonymous visitors
-- ---------------------------------------------------------------------------
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';

select ok((select count(*) from public.profiles) >= 7, 'anon can read profiles');
select ok(not public.is_staff(), 'anon is not staff');
select ok(not public.can_write(), 'anon cannot write');

update public.profiles set bio = 'hacked' where id = '11111111-1111-1111-1111-111111111111';
reset role;
select is(
  (select bio from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  null, 'anon cannot update a profile'
);

-- ---------------------------------------------------------------------------
-- Regular user (alice)
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select ok(not public.is_staff(), 'user is not staff');
select ok(not public.is_admin(), 'user is not admin');
select ok(public.can_write(), 'active user can write');
select ok(not public.can_publish_directly(), 'new user needs review before publishing');

update public.profiles set bio = 'Gallup local', display_name = 'Alice A.'
  where id = '11111111-1111-1111-1111-111111111111';
select is(
  (select bio from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  'Gallup local', 'user can update own bio'
);

-- Updating someone else's row silently affects 0 rows under RLS.
update public.profiles set bio = 'defaced' where id = '22222222-2222-2222-2222-222222222222';

select throws_ok(
  $$update public.profiles set role = 'admin' where id = '11111111-1111-1111-1111-111111111111'$$,
  '42501', 'You cannot change protected profile fields', 'user cannot promote themselves'
);
select throws_ok(
  $$update public.profiles set suspended_until = 'infinity' where id = '11111111-1111-1111-1111-111111111111'$$,
  '42501', 'You cannot change protected profile fields', 'user cannot change their suspension'
);
select throws_ok(
  $$update public.profiles set approved_article_count = 99 where id = '11111111-1111-1111-1111-111111111111'$$,
  '42501', 'You cannot change protected profile fields', 'user cannot change their approval count'
);
select throws_ok(
  $$insert into public.profiles (id, handle, display_name) values (gen_random_uuid(), 'sneaky', 'Sneaky')$$,
  '42501', null, 'user cannot insert profiles directly'
);
select throws_ok(
  $$delete from public.profiles where id = '11111111-1111-1111-1111-111111111111'$$,
  '42501', null, 'user cannot delete profiles directly'
);

reset role;
select is(
  (select bio from public.profiles where id = '22222222-2222-2222-2222-222222222222'),
  null, 'user cannot update another user''s profile'
);

-- ---------------------------------------------------------------------------
-- Staff helpers
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
select ok(public.is_staff() and not public.is_admin(), 'moderator is staff but not admin');

set local request.jwt.claims to '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}';
select ok(public.is_staff() and public.is_admin(), 'admin is staff and admin');

-- ---------------------------------------------------------------------------
-- Suspended user
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"77777777-7777-7777-7777-777777777777","role":"authenticated"}';
select ok(public.is_suspended() and not public.can_write(), 'suspended user cannot write');

update public.profiles set bio = 'spam spam' where id = '77777777-7777-7777-7777-777777777777';
reset role;
select is(
  (select bio from public.profiles where id = '77777777-7777-7777-7777-777777777777'),
  null, 'suspended user cannot edit their profile'
);

select * from finish();
rollback;
