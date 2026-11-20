-- Follows and the Following feed (migration 20261121020000).
begin;
select plan(19);

-- Start from no stories (seed.sql and local e2e runs add some); rolled back at the end.
delete from public.articles;

-- fan, writer1, writer2, sus (suspended)
insert into auth.users (id, email, raw_user_meta_data) values
  ('b0b00000-0000-0000-0000-000000000001', 'fan@test.local',
   '{"handle":"ffan","display_name":"Fan","age_confirmed":true,"accepted_terms_version":2,"accepted_privacy_version":2}'),
  ('b0b00000-0000-0000-0000-000000000002', 'w1@test.local',
   '{"handle":"fwriter1","display_name":"Writer One","age_confirmed":true,"accepted_terms_version":2,"accepted_privacy_version":2}'),
  ('b0b00000-0000-0000-0000-000000000003', 'w2@test.local',
   '{"handle":"fwriter2","display_name":"Writer Two","age_confirmed":true,"accepted_terms_version":2,"accepted_privacy_version":2}'),
  ('b0b00000-0000-0000-0000-000000000004', 'sus@test.local',
   '{"handle":"fsus","display_name":"Sus","age_confirmed":true,"accepted_terms_version":2,"accepted_privacy_version":2}');
update public.profiles set suspended_until = now() + interval '1 day' where handle = 'fsus';

insert into public.articles (id, author_id, slug, title, category, body_json, status, submitted_at, published_at) values
  ('b0b00000-0000-0000-0000-0000000000a1', 'b0b00000-0000-0000-0000-000000000002', 'w1-old', 'Writer one older', 'news',
   '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"x"}]}]}', 'published', now(), now() - interval '2 days'),
  ('b0b00000-0000-0000-0000-0000000000a2', 'b0b00000-0000-0000-0000-000000000002', 'w1-new', 'Writer one newer', 'news',
   '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"x"}]}]}', 'published', now(), now() - interval '1 hour'),
  ('b0b00000-0000-0000-0000-0000000000a3', 'b0b00000-0000-0000-0000-000000000003', 'w2-story', 'Writer two story', 'news',
   '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"x"}]}]}', 'published', now(), now() - interval '3 hours');
insert into public.articles (id, author_id, title, status) values
  ('b0b00000-0000-0000-0000-0000000000a4', 'b0b00000-0000-0000-0000-000000000002', 'Writer one draft', 'draft');

set local role authenticated;
set local request.jwt.claims to '{"sub":"b0b00000-0000-0000-0000-000000000001","role":"authenticated"}';

select is((select count(*)::int from public.feed_following()), 0, 'the Following feed is empty before following anyone');
select lives_ok($$insert into public.follows (followee_id) values ('b0b00000-0000-0000-0000-000000000002')$$, 'follow a writer');
select throws_ok($$insert into public.follows (followee_id) values ('b0b00000-0000-0000-0000-000000000002')$$,
  '23505', null, 'following twice is rejected');
select throws_ok($$insert into public.follows (followee_id) values ('b0b00000-0000-0000-0000-000000000001')$$,
  '23514', null, 'you cannot follow yourself');
select throws_ok(
  $$insert into public.follows (follower_id, followee_id) values ('b0b00000-0000-0000-0000-000000000003', 'b0b00000-0000-0000-0000-000000000002')$$,
  '42501', null, 'clients cannot follow on behalf of someone else');
select is((select array_agg(slug) from public.feed_following()), '{w1-new,w1-old}'::text[],
  'the feed has published stories by followed writers, newest first (no drafts, no others)');
select is(
  (select array_agg(slug) from public.feed_following(
    p_before_published_at => (select published_at from public.articles where slug = 'w1-new'),
    p_before_id => 'b0b00000-0000-0000-0000-0000000000a2')),
  '{w1-old}'::text[], 'the feed pages with a cursor');
select is((select row(followers, following, is_following, can_follow)::text from public.follow_context('b0b00000-0000-0000-0000-000000000002')),
  '(1,0,t,t)', 'context for a followed writer');
select is((select row(followers, following, is_following, can_follow)::text from public.follow_context('b0b00000-0000-0000-0000-000000000001')),
  '(0,1,f,f)', 'context for yourself: cannot follow');

-- writer2 follows writer1 too; each sees only their own rows.
set local request.jwt.claims to '{"sub":"b0b00000-0000-0000-0000-000000000003","role":"authenticated"}';
select lives_ok($$insert into public.follows (followee_id) values ('b0b00000-0000-0000-0000-000000000002')$$, 'second follower');
select is((select count(*)::int from public.follows), 1, 'users see only whom they follow');
select is((select followers from public.follow_context('b0b00000-0000-0000-0000-000000000002')), 2, 'follower counts include everyone');
select lives_ok($$delete from public.follows$$, 'unfollow');
select is((select followers from public.follow_context('b0b00000-0000-0000-0000-000000000002')), 1,
  'unfollowing only removes your own follow');

-- Suspended users cannot follow.
set local request.jwt.claims to '{"sub":"b0b00000-0000-0000-0000-000000000004","role":"authenticated"}';
select throws_ok($$insert into public.follows (followee_id) values ('b0b00000-0000-0000-0000-000000000002')$$,
  '42501', null, 'suspended users cannot follow');

-- Daily limit.
reset role;
insert into auth.users (id, email, raw_user_meta_data)
select ('b0b00000-0000-0000-0001-' || lpad(g::text, 12, '0'))::uuid, 'many' || g || '@test.local',
  jsonb_build_object('handle', 'many' || g, 'display_name', 'Many ' || g)
from generate_series(1, 101) g;
insert into public.follows (follower_id, followee_id, created_at)
select 'b0b00000-0000-0000-0000-000000000001', ('b0b00000-0000-0000-0001-' || lpad(g::text, 12, '0'))::uuid, now()
from generate_series(1, 99) g;
set local role authenticated;
set local request.jwt.claims to '{"sub":"b0b00000-0000-0000-0000-000000000001","role":"authenticated"}';
select throws_ok($$insert into public.follows (followee_id) values ('b0b00000-0000-0000-0001-000000000100')$$,
  'PT429', null, 'at most 100 new follows a day');

-- anon
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select is((select count(*)::int from public.follows), 0, 'anon sees no follows');
select is((select count(*)::int from public.feed_following()), 0, 'anon gets an empty Following feed');
select is((select row(followers, is_following, can_follow)::text from public.follow_context('b0b00000-0000-0000-0000-000000000002')),
  '(1,f,f)', 'anon sees counts only');

select * from finish();
rollback;
