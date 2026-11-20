-- Soft delete by authors, restore by staff (migration 20261124000000).
begin;
select plan(11);

delete from public.articles;

insert into auth.users (id, email, raw_user_meta_data) values
  ('b2b20000-0000-0000-0000-000000000001', 'sd1@test.local',
   '{"handle":"sdauthor","display_name":"SD Author","age_confirmed":true,"accepted_terms_version":2,"accepted_privacy_version":2}'),
  ('b2b20000-0000-0000-0000-000000000002', 'sd2@test.local',
   '{"handle":"sdother","display_name":"SD Other","age_confirmed":true,"accepted_terms_version":2,"accepted_privacy_version":2}'),
  ('b2b20000-0000-0000-0000-000000000003', 'sd3@test.local',
   '{"handle":"sdmod","display_name":"SD Mod","age_confirmed":true,"accepted_terms_version":2,"accepted_privacy_version":2}');
update public.profiles set role = 'moderator' where handle = 'sdmod';

insert into public.articles (id, author_id, slug, title, category, body_json, status, submitted_at, published_at) values
  ('b2b20000-0000-0000-0000-0000000000a1', 'b2b20000-0000-0000-0000-000000000001', 'sd-pub', 'Soft delete published', 'news',
   '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"x"}]}]}', 'published', now(), now());
insert into public.articles (id, author_id, title, status) values
  ('b2b20000-0000-0000-0000-0000000000a2', 'b2b20000-0000-0000-0000-000000000001', 'Soft delete draft', 'draft');

set local role authenticated;
set local request.jwt.claims to '{"sub":"b2b20000-0000-0000-0000-000000000002","role":"authenticated"}';
select is(public.delete_article('b2b20000-0000-0000-0000-0000000000a1'), false, 'others cannot delete your story');

set local request.jwt.claims to '{"sub":"b2b20000-0000-0000-0000-000000000001","role":"authenticated"}';
select is(public.delete_article('b2b20000-0000-0000-0000-0000000000a2'), false,
  'unsubmitted drafts are not soft-deleted (they are hard-deleted instead)');
reset role;
update public.profiles set suspended_until = now() + interval '1 day' where handle = 'sdauthor';
set local role authenticated;
select is(public.delete_article('b2b20000-0000-0000-0000-0000000000a1'), true, 'authors delete their own story, even while suspended');
select is(public.delete_article('b2b20000-0000-0000-0000-0000000000a1'), false, 'deleting twice does nothing');
select is((select count(*)::int from public.articles where id = 'b2b20000-0000-0000-0000-0000000000a1'), 0,
  'the author no longer sees the deleted story');

set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select is((select count(*)::int from public.feed_latest()), 0, 'deleted stories leave the feeds');

set local role authenticated;
set local request.jwt.claims to '{"sub":"b2b20000-0000-0000-0000-000000000003","role":"authenticated"}';
select ok((select deleted_at is not null from public.articles where id = 'b2b20000-0000-0000-0000-0000000000a1'),
  'staff still see the deleted story');
select throws_ok($$select public.staff_article_action('b2b20000-0000-0000-0000-0000000000a1', 'hide', 'x')$$,
  'P0002', null, 'other actions skip deleted stories');
select is(public.staff_article_action('b2b20000-0000-0000-0000-0000000000a1', 'restore_deleted', 'Deleted by mistake, author asked'),
  'published'::public.article_status, 'staff restore a deleted story');
select is((select action::text from public.moderation_actions where article_id = 'b2b20000-0000-0000-0000-0000000000a1' order by id desc limit 1),
  'restore_deleted_article', 'the restore is logged');
select throws_ok($$select public.staff_article_action('b2b20000-0000-0000-0000-0000000000a1', 'restore_deleted', 'x')$$,
  '55000', null, 'only deleted stories can be undeleted');

select * from finish();
rollback;
