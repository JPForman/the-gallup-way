-- Views and Top Stories (migration 20261120030000).
begin;
select plan(16);

-- Start from no stories (seed.sql and local e2e runs add some); rolled back at the end.
delete from public.articles;

insert into auth.users (id, email, raw_user_meta_data) values
  ('acac0000-0000-0000-0000-000000000001', 'top@test.local',
   '{"handle":"toptest","display_name":"Top Writer","age_confirmed":true,"accepted_terms_version":2,"accepted_privacy_version":2}'),
  ('acac0000-0000-0000-0000-000000000002', 'reader@test.local',
   '{"handle":"readertest","display_name":"Reader","age_confirmed":true,"accepted_terms_version":2,"accepted_privacy_version":2}');

-- new: 1h old; mid: 10h old; old: 3 days; stale: 8 days (outside the window);
-- draft: never published.
insert into public.articles (id, author_id, slug, title, category, body_json, status, submitted_at, published_at) values
  ('acac0000-0000-0000-0000-0000000000a1', 'acac0000-0000-0000-0000-000000000001', 'new-a1', 'Newest story', 'news',
   '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"x"}]}]}', 'published', now(), now() - interval '1 hour'),
  ('acac0000-0000-0000-0000-0000000000a2', 'acac0000-0000-0000-0000-000000000001', 'mid-a2', 'Middle story', 'news',
   '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"x"}]}]}', 'published', now(), now() - interval '10 hours'),
  ('acac0000-0000-0000-0000-0000000000a3', 'acac0000-0000-0000-0000-000000000001', 'old-a3', 'Older story', 'news',
   '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"x"}]}]}', 'published', now(), now() - interval '3 days'),
  ('acac0000-0000-0000-0000-0000000000a4', 'acac0000-0000-0000-0000-000000000001', 'stale-a4', 'Stale story', 'news',
   '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"x"}]}]}', 'published', now(), now() - interval '8 days');
insert into public.articles (id, author_id, title, status) values
  ('acac0000-0000-0000-0000-0000000000a5', 'acac0000-0000-0000-0000-000000000001', 'Draft', 'draft');

-- ---------------------------------------------------------------------------
-- ranking_score (same cases as src/lib/ranking.test.ts)
-- ---------------------------------------------------------------------------
select is(round(public.ranking_score(10, 2, 50, 3)::numeric, 6), 1.431084, 'score: (10 + 4 + 2) / 5^1.5');
select is(public.ranking_score(0, 0, 0, 0), 0::double precision, 'no engagement scores 0');
select is(round(public.ranking_score(0, 0, 25, -5)::numeric, 6), 0.353553, 'future dates count as 0 hours');

-- ---------------------------------------------------------------------------
-- record_view
-- ---------------------------------------------------------------------------
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select ok(public.record_view('acac0000-0000-0000-0000-0000000000a3'), 'anon view is counted');
select ok(public.record_view('acac0000-0000-0000-0000-0000000000a3'), 'second view is counted');
select ok(not public.record_view('acac0000-0000-0000-0000-0000000000a5'), 'drafts are not counted');
select ok(not public.record_view(gen_random_uuid()), 'unknown ids are not counted');
select is((select sum(views)::int from public.article_views where article_id = 'acac0000-0000-0000-0000-0000000000a3'), 2,
  'anon can read view totals of published stories');
select is((select count(*)::int from public.article_views where article_id = 'acac0000-0000-0000-0000-0000000000a3'), 1,
  'views are one row per story per day');
select throws_ok($$insert into public.article_views (article_id, views) values ('acac0000-0000-0000-0000-0000000000a1', 999)$$,
  '42501', null, 'clients cannot write view rows');

set local role authenticated;
set local request.jwt.claims to '{"sub":"acac0000-0000-0000-0000-000000000001","role":"authenticated"}';
select ok(not public.record_view('acac0000-0000-0000-0000-0000000000a3'), 'the author''s own views are not counted');
select throws_ok($$update public.article_views set views = 1000$$, '42501', null, 'clients cannot change view counts');

-- ---------------------------------------------------------------------------
-- top_stories
-- ---------------------------------------------------------------------------
reset role;
-- Give "old" lots of views and "mid" a few. Days are Gallup-local, like record_view().
insert into public.article_views (article_id, day, views) values
  ('acac0000-0000-0000-0000-0000000000a3', (now() at time zone 'America/Denver')::date - 1, 2000),
  ('acac0000-0000-0000-0000-0000000000a2', (now() at time zone 'America/Denver')::date, 100),
  ('acac0000-0000-0000-0000-0000000000a4', (now() at time zone 'America/Denver')::date, 100000);

set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select is((select array_agg(slug) from public.top_stories()), '{old-a3,mid-a2,new-a1}'::text[],
  'ranked by score; stale and draft stories are left out');
select is(
  (select round(score::numeric, 6) from public.top_stories() where slug = 'new-a1'),
  0::numeric, 'no engagement scores 0');
select ok(
  (select score from public.top_stories() where slug = 'old-a3') > (select score from public.top_stories() where slug = 'mid-a2'),
  'views push older stories up');
select is((select count(*)::int from public.top_stories(p_limit => 1)), 1, 'limit applies');

select * from finish();
rollback;
