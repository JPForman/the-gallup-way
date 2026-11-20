-- Likes (migration 20261121000000).
begin;
select plan(20);

-- Start from no stories (seed.sql and local e2e runs add some); rolled back at the end.
delete from public.articles;

-- author, fan, fan2, sus (suspended)
insert into auth.users (id, email, raw_user_meta_data) values
  ('aeae0000-0000-0000-0000-000000000001', 'author@test.local',
   '{"handle":"likeauthor","display_name":"Author","age_confirmed":true,"accepted_terms_version":2,"accepted_privacy_version":2}'),
  ('aeae0000-0000-0000-0000-000000000002', 'fan@test.local',
   '{"handle":"likefan","display_name":"Fan","age_confirmed":true,"accepted_terms_version":2,"accepted_privacy_version":2}'),
  ('aeae0000-0000-0000-0000-000000000003', 'fan2@test.local',
   '{"handle":"likefan2","display_name":"Fan Two","age_confirmed":true,"accepted_terms_version":2,"accepted_privacy_version":2}'),
  ('aeae0000-0000-0000-0000-000000000004', 'sus@test.local',
   '{"handle":"likesus","display_name":"Sus","age_confirmed":true,"accepted_terms_version":2,"accepted_privacy_version":2}');
update public.profiles set suspended_until = now() + interval '1 day' where handle = 'likesus';

insert into public.articles (id, author_id, slug, title, category, body_json, status, submitted_at, published_at) values
  ('aeae0000-0000-0000-0000-0000000000a1', 'aeae0000-0000-0000-0000-000000000001', 'liked-story',
   'A likeable story', 'news', '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"x"}]}]}',
   'published', now(), now() - interval '3 hours'),
  ('aeae0000-0000-0000-0000-0000000000a2', 'aeae0000-0000-0000-0000-000000000001', 'other-story',
   'Another story', 'news', '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"x"}]}]}',
   'published', now(), now() - interval '3 hours');
insert into public.articles (id, author_id, title, status) values
  ('aeae0000-0000-0000-0000-0000000000a3', 'aeae0000-0000-0000-0000-000000000001', 'A draft', 'draft');

-- fan likes
set local role authenticated;
set local request.jwt.claims to '{"sub":"aeae0000-0000-0000-0000-000000000002","role":"authenticated"}';
select lives_ok($$insert into public.reactions (article_id) values ('aeae0000-0000-0000-0000-0000000000a1')$$,
  'a writer can like a published story');
select throws_ok($$insert into public.reactions (article_id) values ('aeae0000-0000-0000-0000-0000000000a1')$$,
  '23505', null, 'one like per person per story');
select throws_ok($$insert into public.reactions (article_id, kind) values ('aeae0000-0000-0000-0000-0000000000a2', 'dislike')$$,
  '23514', null, 'dislikes are not enabled');
select throws_ok($$insert into public.reactions (article_id) values ('aeae0000-0000-0000-0000-0000000000a3')$$,
  '42501', null, 'drafts cannot be liked');
select throws_ok(
  $$insert into public.reactions (article_id, user_id) values ('aeae0000-0000-0000-0000-0000000000a2', 'aeae0000-0000-0000-0000-000000000003')$$,
  '42501', null, 'clients cannot like on behalf of someone else');
select is((select row(like_count, liked, can_like)::text from public.article_engagement('aeae0000-0000-0000-0000-0000000000a1')),
  '(1,t,t)', 'engagement: count, liked, can like');

-- fan2 likes too; sees only their own row but the full count
set local request.jwt.claims to '{"sub":"aeae0000-0000-0000-0000-000000000003","role":"authenticated"}';
select lives_ok($$insert into public.reactions (article_id) values ('aeae0000-0000-0000-0000-0000000000a1')$$, 'second like');
select is((select count(*)::int from public.reactions), 1, 'users see only their own likes');
select is(public.like_count('aeae0000-0000-0000-0000-0000000000a1'), 2, 'the count includes everyone');
select lives_ok($$delete from public.reactions where article_id = 'aeae0000-0000-0000-0000-0000000000a1'$$, 'unlike');
select is(public.like_count('aeae0000-0000-0000-0000-0000000000a1'), 1, 'unliking lowers the count');

-- fan2 cannot remove fan's like
select lives_ok($$delete from public.reactions$$, 'deleting others'' likes is a no-op');
select is(public.like_count('aeae0000-0000-0000-0000-0000000000a1'), 1, 'other people''s likes stay');

-- author cannot like their own story
set local request.jwt.claims to '{"sub":"aeae0000-0000-0000-0000-000000000001","role":"authenticated"}';
select throws_ok($$insert into public.reactions (article_id) values ('aeae0000-0000-0000-0000-0000000000a1')$$,
  '42501', null, 'authors cannot like their own story');
select is((select can_like from public.article_engagement('aeae0000-0000-0000-0000-0000000000a1')), false,
  'engagement says the author cannot like');

-- suspended users cannot like
set local request.jwt.claims to '{"sub":"aeae0000-0000-0000-0000-000000000004","role":"authenticated"}';
select throws_ok($$insert into public.reactions (article_id) values ('aeae0000-0000-0000-0000-0000000000a1')$$,
  '42501', null, 'suspended users cannot like');

-- anon
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select throws_ok($$select * from public.reactions$$, '42501', null, 'anon cannot read reactions');
select is((select row(like_count, liked, can_like)::text from public.article_engagement('aeae0000-0000-0000-0000-0000000000a1')),
  '(1,f,f)', 'anon sees the count only');
select is(public.like_count('aeae0000-0000-0000-0000-0000000000a3'), 0, 'drafts report 0');

-- Likes feed Top Stories: the liked story outranks the other (same age, no views).
select is((select array_agg(slug) from public.top_stories()), '{liked-story,other-story}'::text[], 'likes raise the Top score');

select * from finish();
rollback;
