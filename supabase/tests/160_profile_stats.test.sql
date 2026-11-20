-- Contributor stats and author feed (migration 20261122010000).
begin;
select plan(8);

delete from public.articles;

insert into auth.users (id, email, raw_user_meta_data) values
  ('d0d00000-0000-0000-0000-000000000001', 'sw@test.local',
   '{"handle":"swriter","display_name":"Stats Writer","age_confirmed":true,"accepted_terms_version":2,"accepted_privacy_version":2}'),
  ('d0d00000-0000-0000-0000-000000000002', 'sr@test.local',
   '{"handle":"sreader","display_name":"Stats Reader","age_confirmed":true,"accepted_terms_version":2,"accepted_privacy_version":2}');

insert into public.articles (id, author_id, slug, title, category, body_json, status, submitted_at, published_at) values
  ('d0d00000-0000-0000-0000-0000000000a1', 'd0d00000-0000-0000-0000-000000000001', 's-old', 'Stats story older', 'news',
   '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"x"}]}]}', 'published', now(), now() - interval '2 days'),
  ('d0d00000-0000-0000-0000-0000000000a2', 'd0d00000-0000-0000-0000-000000000001', 's-new', 'Stats story newer', 'news',
   '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"x"}]}]}', 'published', now(), now() - interval '1 day'),
  ('d0d00000-0000-0000-0000-0000000000a3', 'd0d00000-0000-0000-0000-000000000001', 's-gone', 'Stats story deleted', 'news',
   '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"x"}]}]}', 'published', now(), now() - interval '3 hours');
insert into public.articles (id, author_id, title, status) values
  ('d0d00000-0000-0000-0000-0000000000a4', 'd0d00000-0000-0000-0000-000000000001', 'Stats draft story', 'draft');

-- Engagement: likes, comments (one later deleted), views; some on the story that gets deleted.
insert into public.reactions (article_id, user_id) values
  ('d0d00000-0000-0000-0000-0000000000a1', 'd0d00000-0000-0000-0000-000000000002'),
  ('d0d00000-0000-0000-0000-0000000000a2', 'd0d00000-0000-0000-0000-000000000002'),
  ('d0d00000-0000-0000-0000-0000000000a3', 'd0d00000-0000-0000-0000-000000000002');
insert into public.comments (article_id, author_id, body) values
  ('d0d00000-0000-0000-0000-0000000000a1', 'd0d00000-0000-0000-0000-000000000002', 'Nice one'),
  ('d0d00000-0000-0000-0000-0000000000a2', 'd0d00000-0000-0000-0000-000000000002', 'Good'),
  ('d0d00000-0000-0000-0000-0000000000a3', 'd0d00000-0000-0000-0000-000000000002', 'On a deleted story');
insert into public.comments (article_id, author_id, body, deleted_at) values
  ('d0d00000-0000-0000-0000-0000000000a2', 'd0d00000-0000-0000-0000-000000000002', '', now());
insert into public.article_views (article_id, day, views) values
  ('d0d00000-0000-0000-0000-0000000000a1', (now() at time zone 'America/Denver')::date, 10),
  ('d0d00000-0000-0000-0000-0000000000a2', (now() at time zone 'America/Denver')::date, 5),
  ('d0d00000-0000-0000-0000-0000000000a3', (now() at time zone 'America/Denver')::date, 100);
update public.articles set deleted_at = now() where slug = 's-gone';

set local role anon;
set local request.jwt.claims to '{"role":"anon"}';

select is((select row(stories, likes, comments, views)::text from public.profile_stats('d0d00000-0000-0000-0000-000000000001')),
  '(2,2,2,15)', 'stats count published stories only, without deleted comments');
select is((select row(stories, likes, comments, views)::text from public.profile_stats('d0d00000-0000-0000-0000-000000000002')),
  '(0,0,0,0)', 'a reader with no stories has zero stats');
select is((select row(stories, likes, comments, views)::text from public.profile_stats('d0d00000-0000-0000-0000-0000000000ff')),
  '(0,0,0,0)', 'unknown profiles return zeros');
select is((select array_agg(slug) from public.feed_author('d0d00000-0000-0000-0000-000000000001')),
  '{s-new,s-old}'::text[], 'the author feed lists published stories newest first');
select is(
  (select array_agg(slug) from public.feed_author('d0d00000-0000-0000-0000-000000000001',
    (select published_at from public.articles where slug = 's-new'), 'd0d00000-0000-0000-0000-0000000000a2')),
  '{s-old}'::text[], 'the author feed pages with a cursor');
select is((select count(*)::int from public.feed_author('d0d00000-0000-0000-0000-000000000002')), 0,
  'readers without stories have an empty feed');

-- The author themself still sees only published stories here (drafts stay in /me).
set local role authenticated;
set local request.jwt.claims to '{"sub":"d0d00000-0000-0000-0000-000000000001","role":"authenticated"}';
select is((select count(*)::int from public.feed_author('d0d00000-0000-0000-0000-000000000001')), 2,
  'authors don''t see their drafts in the public list');
select is((select stories from public.profile_stats('d0d00000-0000-0000-0000-000000000001')), 2,
  'stats are the same for the author');

select * from finish();
rollback;
