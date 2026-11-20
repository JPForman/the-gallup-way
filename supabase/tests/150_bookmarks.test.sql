-- Bookmarks / Saved (migration 20261122000000).
begin;
select plan(14);

delete from public.articles;

insert into auth.users (id, email, raw_user_meta_data) values
  ('c0c00000-0000-0000-0000-000000000001', 'reader@test.local',
   '{"handle":"breader","display_name":"Reader","age_confirmed":true,"accepted_terms_version":1,"accepted_privacy_version":1}'),
  ('c0c00000-0000-0000-0000-000000000002', 'bw@test.local',
   '{"handle":"bwriter","display_name":"Writer","age_confirmed":true,"accepted_terms_version":1,"accepted_privacy_version":1}'),
  ('c0c00000-0000-0000-0000-000000000003', 'bsus@test.local',
   '{"handle":"bsus","display_name":"Sus","age_confirmed":true,"accepted_terms_version":1,"accepted_privacy_version":1}');
update public.profiles set suspended_until = now() + interval '1 day' where handle = 'bsus';

insert into public.articles (id, author_id, slug, title, category, body_json, status, submitted_at, published_at) values
  ('c0c00000-0000-0000-0000-0000000000a1', 'c0c00000-0000-0000-0000-000000000002', 'b-one', 'Saved story one', 'news',
   '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"x"}]}]}', 'published', now(), now() - interval '2 days'),
  ('c0c00000-0000-0000-0000-0000000000a2', 'c0c00000-0000-0000-0000-000000000002', 'b-two', 'Saved story two', 'news',
   '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"x"}]}]}', 'published', now(), now() - interval '1 day');
insert into public.articles (id, author_id, title, status) values
  ('c0c00000-0000-0000-0000-0000000000a3', 'c0c00000-0000-0000-0000-000000000002', 'Saved story draft', 'draft');

set local role authenticated;
set local request.jwt.claims to '{"sub":"c0c00000-0000-0000-0000-000000000001","role":"authenticated"}';

select lives_ok($$insert into public.bookmarks (article_id) values ('c0c00000-0000-0000-0000-0000000000a1')$$, 'save a story');
select lives_ok($$insert into public.bookmarks (article_id) values ('c0c00000-0000-0000-0000-0000000000a2')$$, 'save another');
select throws_ok($$insert into public.bookmarks (article_id) values ('c0c00000-0000-0000-0000-0000000000a1')$$,
  '23505', null, 'saving twice is rejected');
select throws_ok($$insert into public.bookmarks (article_id) values ('c0c00000-0000-0000-0000-0000000000a3')$$,
  '42501', null, 'drafts cannot be saved');
select throws_ok(
  $$insert into public.bookmarks (user_id, article_id) values ('c0c00000-0000-0000-0000-000000000002', 'c0c00000-0000-0000-0000-0000000000a1')$$,
  '42501', null, 'clients cannot save for someone else');
select is((select array_agg(slug) from public.saved_articles()), '{b-two,b-one}'::text[], 'most recently saved first');
select is(
  (select array_agg(slug) from public.saved_articles(
    p_before_saved_at => (select created_at from public.bookmarks where article_id = 'c0c00000-0000-0000-0000-0000000000a2'),
    p_before_id => 'c0c00000-0000-0000-0000-0000000000a2')),
  '{b-one}'::text[], 'saved stories page with a cursor');

-- Deleted stories drop out.
reset role;
update public.articles set deleted_at = now() where slug = 'b-one';
set local role authenticated;
select is((select array_agg(slug) from public.saved_articles()), '{b-two}'::text[], 'deleted stories drop out of Saved');

-- Another user sees none of them.
set local request.jwt.claims to '{"sub":"c0c00000-0000-0000-0000-000000000002","role":"authenticated"}';
select is((select count(*)::int from public.bookmarks), 0, 'bookmarks are private');
select is((select count(*)::int from public.saved_articles()), 0, 'Saved lists only your own');
select lives_ok($$delete from public.bookmarks$$, 'deleting runs');
reset role;
select is((select count(*)::int from public.bookmarks), 2, '...but cannot remove someone else''s bookmarks');

-- Suspended users may still save (private reading list).
set local role authenticated;
set local request.jwt.claims to '{"sub":"c0c00000-0000-0000-0000-000000000003","role":"authenticated"}';
select lives_ok($$insert into public.bookmarks (article_id) values ('c0c00000-0000-0000-0000-0000000000a2')$$,
  'suspended users can still save stories');

-- anon has no access.
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select throws_ok($$select * from public.bookmarks$$, '42501', null, 'anon cannot read bookmarks');

select * from finish();
rollback;
