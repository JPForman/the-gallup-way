-- Account deletion (migration 20261125000000).
begin;
select plan(14);

delete from public.articles;

insert into auth.users (id, email, raw_user_meta_data) values
  ('c3c30000-0000-0000-0000-000000000001', 'leave1@test.local',
   '{"handle":"leaver1","display_name":"Leaver One","age_confirmed":true,"accepted_terms_version":1,"accepted_privacy_version":1}'),
  ('c3c30000-0000-0000-0000-000000000002', 'leave2@test.local',
   '{"handle":"leaver2","display_name":"Leaver Two","age_confirmed":true,"accepted_terms_version":1,"accepted_privacy_version":1}'),
  ('c3c30000-0000-0000-0000-000000000003', 'stay@test.local',
   '{"handle":"stayer","display_name":"Stayer","age_confirmed":true,"accepted_terms_version":1,"accepted_privacy_version":1}'),
  ('c3c30000-0000-0000-0000-000000000004', 'boss@test.local',
   '{"handle":"bossadmin","display_name":"Boss","age_confirmed":true,"accepted_terms_version":1,"accepted_privacy_version":1}');
update public.profiles set role = 'admin' where handle = 'bossadmin';
update public.profiles set avatar_path = 'c3c30000-0000-0000-0000-000000000001/a.webp' where handle = 'leaver1';

-- Each leaver: one published story (with a photo), one draft. Stayer: one story.
insert into public.articles (id, author_id, slug, title, category, body_json, status, submitted_at, published_at) values
  ('c3c30000-0000-0000-0000-0000000000a1', 'c3c30000-0000-0000-0000-000000000001', 'l1-pub', 'Leaver one published', 'news',
   '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"x"}]}]}', 'published', now(), now()),
  ('c3c30000-0000-0000-0000-0000000000b1', 'c3c30000-0000-0000-0000-000000000002', 'l2-pub', 'Leaver two published', 'news',
   '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"x"}]}]}', 'published', now(), now()),
  ('c3c30000-0000-0000-0000-0000000000c1', 'c3c30000-0000-0000-0000-000000000003', 'st-pub', 'Stayer published', 'news',
   '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"x"}]}]}', 'published', now(), now());
insert into public.articles (id, author_id, title, status) values
  ('c3c30000-0000-0000-0000-0000000000a2', 'c3c30000-0000-0000-0000-000000000001', 'Leaver one draft', 'draft'),
  ('c3c30000-0000-0000-0000-0000000000b2', 'c3c30000-0000-0000-0000-000000000002', 'Leaver two draft', 'draft');
insert into public.article_images (article_id, storage_path, alt_text, position) values
  ('c3c30000-0000-0000-0000-0000000000a1', 'c3c30000-0000-0000-0000-000000000001/c3c30000-0000-0000-0000-0000000000a1/p.webp', 'Photo', 0),
  ('c3c30000-0000-0000-0000-0000000000a2', 'c3c30000-0000-0000-0000-000000000001/c3c30000-0000-0000-0000-0000000000a2/p.webp', 'Photo', 0),
  ('c3c30000-0000-0000-0000-0000000000b1', 'c3c30000-0000-0000-0000-000000000002/c3c30000-0000-0000-0000-0000000000b1/p.webp', 'Photo', 0);
insert into public.comments (article_id, author_id, body) values
  ('c3c30000-0000-0000-0000-0000000000c1', 'c3c30000-0000-0000-0000-000000000001', 'Leaver one says hi'),
  ('c3c30000-0000-0000-0000-0000000000c1', 'c3c30000-0000-0000-0000-000000000002', 'Leaver two says hi');
insert into public.reactions (article_id, user_id) values ('c3c30000-0000-0000-0000-0000000000c1', 'c3c30000-0000-0000-0000-000000000001');
insert into public.follows (follower_id, followee_id) values ('c3c30000-0000-0000-0000-000000000001', 'c3c30000-0000-0000-0000-000000000003');

set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select throws_ok($$select * from public.prepare_account_deletion('anonymize')$$, '42501', null, 'anon cannot call it');

set local role authenticated;
set local request.jwt.claims to '{"sub":"c3c30000-0000-0000-0000-000000000004","role":"authenticated"}';
select throws_ok($$select * from public.prepare_account_deletion('anonymize')$$, '42501', null, 'admins cannot delete themselves');

-- Leaver one: anonymize.
set local request.jwt.claims to '{"sub":"c3c30000-0000-0000-0000-000000000001","role":"authenticated"}';
select throws_ok($$select * from public.prepare_account_deletion('erase')$$, '22023', null, 'unknown modes are rejected');
select is(
  (select array_agg(bucket || ':' || path order by bucket, path) from public.prepare_account_deletion('anonymize')),
  '{article-images:c3c30000-0000-0000-0000-000000000001/c3c30000-0000-0000-0000-0000000000a2/p.webp,avatars:c3c30000-0000-0000-0000-000000000001/a.webp}'::text[],
  'anonymize returns the draft''s photo and the avatar to remove');

-- Leaver two: delete.
set local request.jwt.claims to '{"sub":"c3c30000-0000-0000-0000-000000000002","role":"authenticated"}';
select is(
  (select array_agg(bucket || ':' || path) from public.prepare_account_deletion('delete')),
  '{article-images:c3c30000-0000-0000-0000-000000000002/c3c30000-0000-0000-0000-0000000000b1/p.webp}'::text[],
  'delete returns every story photo');

reset role;
select is((select array_agg(slug order by slug) from public.articles where author_id = 'c3c30000-0000-0000-0000-000000000001'),
  '{l1-pub}'::text[], 'anonymize keeps only the published story');
select is((select count(*)::int from public.articles where author_id = 'c3c30000-0000-0000-0000-000000000002'), 0,
  'delete removes every story');
select is((select body from public.comments where author_id = 'c3c30000-0000-0000-0000-000000000001'), 'Leaver one says hi',
  'anonymize keeps comments');
select is((select row(body, deleted_at is not null)::text from public.comments where author_id = 'c3c30000-0000-0000-0000-000000000002'),
  '("",t)', 'delete erases comment text');

-- Then the app deletes the auth users.
delete from auth.users where id in ('c3c30000-0000-0000-0000-000000000001', 'c3c30000-0000-0000-0000-000000000002');
select is((select count(*)::int from public.profiles where handle in ('leaver1', 'leaver2')), 0, 'profiles are gone');
select is((select author_id::text from public.articles where slug = 'l1-pub'), null, 'kept stories show a former member');
select is((select count(*)::int from public.comments where author_id is null and body = 'Leaver one says hi'), 1,
  'kept comments show a former member');
select is((select count(*)::int from public.reactions where article_id = 'c3c30000-0000-0000-0000-0000000000c1'), 0, 'likes are removed');
select is((select count(*)::int from public.follows where followee_id = 'c3c30000-0000-0000-0000-000000000003'), 0, 'follows are removed');

select * from finish();
rollback;
