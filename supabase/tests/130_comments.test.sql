-- Comments (migration 20261121010000).
begin;
select plan(27);

-- Start from no stories (seed.sql and local e2e runs add some); rolled back at the end.
delete from public.articles;

-- author, reader, other, sus (suspended)
insert into auth.users (id, email, raw_user_meta_data) values
  ('afaf0000-0000-0000-0000-000000000001', 'author@test.local',
   '{"handle":"cauthor","display_name":"Author","age_confirmed":true,"accepted_terms_version":1,"accepted_privacy_version":1}'),
  ('afaf0000-0000-0000-0000-000000000002', 'reader@test.local',
   '{"handle":"creader","display_name":"Reader","age_confirmed":true,"accepted_terms_version":1,"accepted_privacy_version":1}'),
  ('afaf0000-0000-0000-0000-000000000003', 'other@test.local',
   '{"handle":"cother","display_name":"Other","age_confirmed":true,"accepted_terms_version":1,"accepted_privacy_version":1}'),
  ('afaf0000-0000-0000-0000-000000000004', 'sus@test.local',
   '{"handle":"csus","display_name":"Sus","age_confirmed":true,"accepted_terms_version":1,"accepted_privacy_version":1}');
update public.profiles set suspended_until = now() + interval '1 day' where handle = 'csus';

insert into public.articles (id, author_id, slug, title, category, body_json, status, submitted_at, published_at, comments_locked) values
  ('afaf0000-0000-0000-0000-0000000000a1', 'afaf0000-0000-0000-0000-000000000001', 'open-story', 'An open story', 'news',
   '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"x"}]}]}', 'published', now(), now() - interval '3 hours', false),
  ('afaf0000-0000-0000-0000-0000000000a2', 'afaf0000-0000-0000-0000-000000000001', 'locked-story', 'A locked story', 'news',
   '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"x"}]}]}', 'published', now(), now() - interval '3 hours', true),
  ('afaf0000-0000-0000-0000-0000000000a4', 'afaf0000-0000-0000-0000-000000000001', 'quiet-story', 'A quiet story', 'news',
   '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"x"}]}]}', 'published', now(), now() - interval '3 hours', false);
insert into public.articles (id, author_id, title, status) values
  ('afaf0000-0000-0000-0000-0000000000a3', 'afaf0000-0000-0000-0000-000000000001', 'A draft', 'draft');

set local role authenticated;
set local request.jwt.claims to '{"sub":"afaf0000-0000-0000-0000-000000000002","role":"authenticated"}';

select lives_ok($$insert into public.comments (article_id, body) values ('afaf0000-0000-0000-0000-0000000000a1', '  Great news!  ')$$,
  'a writer can comment on a published story');
select is((select row(body, author_id)::text from public.comments), '("Great news!",afaf0000-0000-0000-0000-000000000002)',
  'comment is trimmed and owned by the caller');
select throws_ok($$insert into public.comments (article_id, body) values ('afaf0000-0000-0000-0000-0000000000a1', '   ')$$,
  '23514', null, 'blank comments are rejected');
select throws_ok($$insert into public.comments (article_id, body) values ('afaf0000-0000-0000-0000-0000000000a1', repeat('x', 2001))$$,
  '23514', null, 'comments are at most 2000 characters');
select throws_ok($$insert into public.comments (article_id, body) values ('afaf0000-0000-0000-0000-0000000000a2', 'Hello')$$,
  '42501', null, 'locked stories reject comments');
select throws_ok($$insert into public.comments (article_id, body) values ('afaf0000-0000-0000-0000-0000000000a3', 'Hello')$$,
  '42501', null, 'drafts reject comments');
select throws_ok(
  $$insert into public.comments (article_id, body, author_id) values ('afaf0000-0000-0000-0000-0000000000a1', 'Forged', 'afaf0000-0000-0000-0000-000000000003')$$,
  '42501', null, 'clients cannot set the author');
select throws_ok($$update public.comments set body = 'Edited'$$, '42501', null, 'comments cannot be edited');
select throws_ok($$delete from public.comments$$, '42501', null, 'comments cannot be hard-deleted');

-- Replies
create temp table ids as select id from public.comments where body = 'Great news!';
grant select on ids to authenticated;
set local request.jwt.claims to '{"sub":"afaf0000-0000-0000-0000-000000000003","role":"authenticated"}';
select lives_ok($$insert into public.comments (article_id, parent_id, body)
  select 'afaf0000-0000-0000-0000-0000000000a1', id, 'Agreed.' from ids$$, 'others can reply');
select throws_ok($$insert into public.comments (article_id, parent_id, body)
  select 'afaf0000-0000-0000-0000-0000000000a1', c.id, 'Nested' from public.comments c where c.body = 'Agreed.'$$,
  '23514', null, 'replies cannot be nested');
select throws_ok($$insert into public.comments (article_id, parent_id, body)
  select 'afaf0000-0000-0000-0000-0000000000a4', id, 'Wrong story' from ids$$,
  '23514', null, 'replies must be on the same story');

-- The story's author can comment on their own story.
set local request.jwt.claims to '{"sub":"afaf0000-0000-0000-0000-000000000001","role":"authenticated"}';
select lives_ok($$insert into public.comments (article_id, body) values ('afaf0000-0000-0000-0000-0000000000a1', 'Thanks for reading!')$$,
  'authors can comment on their own story');

-- Suspended users cannot comment.
set local request.jwt.claims to '{"sub":"afaf0000-0000-0000-0000-000000000004","role":"authenticated"}';
select throws_ok($$insert into public.comments (article_id, body) values ('afaf0000-0000-0000-0000-0000000000a1', 'Hi')$$,
  '42501', null, 'suspended users cannot comment');

-- Counts and context
select is(public.comment_count('afaf0000-0000-0000-0000-0000000000a1'), 3, 'comment_count counts comments and replies');
set local request.jwt.claims to '{"sub":"afaf0000-0000-0000-0000-000000000002","role":"authenticated"}';
select is((select row(comment_count, locked, can_comment)::text from public.comments_context('afaf0000-0000-0000-0000-0000000000a1')),
  '(3,f,t)', 'context for a writer on an open story');
select is((select row(comment_count, locked, can_comment)::text from public.comments_context('afaf0000-0000-0000-0000-0000000000a2')),
  '(0,t,f)', 'context on a locked story');

-- Delete your own comment: text erased, row kept for its replies.
select ok(not public.delete_comment((select id from public.comments where body = 'Agreed.')),
  'you cannot delete someone else''s comment');
select ok(public.delete_comment((select id from ids)), 'you can delete your own comment');
select is((select row(body, deleted_at is not null)::text from public.comments where id = (select id from ids)), '("",t)',
  'deleted comments lose their text');
select is((select count(*)::int from public.comments where parent_id = (select id from ids)), 1, 'replies stay');
select is(public.comment_count('afaf0000-0000-0000-0000-0000000000a1'), 2, 'deleted comments are not counted');
select ok(not public.delete_comment((select id from ids)), 'deleting twice does nothing');
select throws_ok($$insert into public.comments (article_id, parent_id, body)
  select 'afaf0000-0000-0000-0000-0000000000a1', id, 'Late reply' from ids$$,
  '23514', null, 'no replies to deleted comments');

-- anon reads comments of visible stories, but cannot write.
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select is((select count(*)::int from public.comments), 3, 'anon reads comments (incl. the deleted placeholder)');
select throws_ok($$insert into public.comments (article_id, body) values ('afaf0000-0000-0000-0000-0000000000a1', 'Anon')$$,
  '42501', null, 'anon cannot comment');

-- Comments raise the Top score: open-story (2 comments) beats quiet-story (none), same age.
select is((select array_agg(slug) from public.top_stories() where slug in ('open-story', 'quiet-story')),
  '{open-story,quiet-story}'::text[], 'comments raise the Top score');

select * from finish();
rollback;
