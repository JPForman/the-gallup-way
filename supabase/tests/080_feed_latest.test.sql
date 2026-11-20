-- Latest feed (migration 20261120010000).
begin;
select plan(10);

-- Start from no stories (seed.sql and local e2e runs add some); rolled back at the end.
delete from public.articles;

insert into auth.users (id, email, raw_user_meta_data) values
  ('abab0000-0000-0000-0000-000000000001', 'feed@test.local',
   '{"handle":"feedtest","display_name":"Feed Writer","age_confirmed":true,"accepted_terms_version":2,"accepted_privacy_version":2}');

-- 25 published stories one hour apart (s01 oldest ... s25 newest), two sharing
-- a timestamp, plus a draft, a pending story and a deleted story.
insert into public.articles (id, author_id, slug, title, category, body_json, status, submitted_at, published_at)
select
  ('abab0000-0000-0000-0000-0000000000' || lpad(g::text, 2, '0'))::uuid,
  'abab0000-0000-0000-0000-000000000001',
  's' || lpad(g::text, 2, '0'),
  'Story number ' || g,
  case when g % 5 = 0 then 'sports' else 'news' end,
  '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Body."}]}]}',
  'published', now(),
  case when g = 24 then timestamptz '2026-11-01 00:00:00+00' + interval '25 hours'
       else timestamptz '2026-11-01 00:00:00+00' + g * interval '1 hour' end
from generate_series(1, 25) g;
insert into public.articles (author_id, slug, title, category, body_json, status, submitted_at, published_at, deleted_at) values
  ('abab0000-0000-0000-0000-000000000001', null, 'A draft', 'news', '{"type":"doc","content":[]}', 'draft', null, null, null),
  ('abab0000-0000-0000-0000-000000000001', 'pending-x', 'Waiting story', 'news',
   '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"x"}]}]}', 'pending_review', now(), null, null),
  ('abab0000-0000-0000-0000-000000000001', 'deleted-x', 'Deleted story', 'news',
   '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"x"}]}]}', 'published', now(), now(), now());
insert into public.article_images (article_id, position, storage_path, alt_text) values
  ('abab0000-0000-0000-0000-000000000025', 0,
   'abab0000-0000-0000-0000-000000000001/abab0000-0000-0000-0000-000000000025/lead.webp', 'Lead photo'),
  ('abab0000-0000-0000-0000-000000000025', 1,
   'abab0000-0000-0000-0000-000000000001/abab0000-0000-0000-0000-000000000025/second.webp', 'Second photo');

set local role anon;
set local request.jwt.claims to '{"role":"anon"}';

select is((select count(*)::int from public.feed_latest()), 20, 'first page has 20 stories');
select is((select array_agg(slug) from (select slug from public.feed_latest(p_limit => 3)) x),
  '{s25,s24,s23}'::text[], 'newest first; equal timestamps ordered by id desc');
select is(
  (select row(author_handle, author_display_name, image_path, image_alt)::text from public.feed_latest(p_limit => 1)),
  '(feedtest,"Feed Writer",abab0000-0000-0000-0000-000000000001/abab0000-0000-0000-0000-000000000025/lead.webp,"Lead photo")',
  'rows include the author and only the lead image');
select is((select count(*)::int from public.feed_latest(p_limit => 50)), 25,
  'drafts, pending and deleted stories are not in the feed');

-- Page 2 starts after the last row of page 1, with no gaps or repeats,
-- even across the tie between s25 and s24.
select is(
  (select array_agg(slug) from public.feed_latest(
    p_before_published_at => (select published_at from public.articles where slug = 's25'),
    p_before_id => 'abab0000-0000-0000-0000-000000000025', p_limit => 2)),
  '{s24,s23}'::text[], 'cursor pages across equal timestamps');
select is(
  (select count(*)::int from public.feed_latest(
    p_before_published_at => (select published_at from public.articles where slug = 's06'),
    p_before_id => 'abab0000-0000-0000-0000-000000000006')),
  5, 'last page has the remaining 5 stories');
select is((select array_agg(slug) from public.feed_latest(p_category => 'sports')),
  '{s25,s20,s15,s10,s05}'::text[], 'category filter');
select is((select count(*)::int from public.feed_latest(p_limit => 500)), 25, 'limit is capped at 50');
select is((select count(*)::int from public.feed_latest(p_limit => 0)), 1, 'limit is at least 1');

-- The author still doesn't see their own draft in the public feed.
set local role authenticated;
set local request.jwt.claims to '{"sub":"abab0000-0000-0000-0000-000000000001","role":"authenticated"}';
select is((select count(*)::int from public.feed_latest(p_limit => 50)), 25, 'authors do not see their drafts in the feed');

select * from finish();
rollback;
