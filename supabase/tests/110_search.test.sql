-- Search (migration 20261120040000).
begin;
select plan(17);

-- Start from no stories (seed.sql and local e2e runs add some); rolled back at the end.
delete from public.articles;
-- Local sample writers (pnpm db:samples) would match the profile searches; rolled back.
delete from auth.users where id::text like '5a5a0000-%';

insert into auth.users (id, email, raw_user_meta_data) values
  ('adad0000-0000-0000-0000-000000000001', 'rosa@test.local',
   '{"handle":"rosa_y","display_name":"Rosa Yazzie","age_confirmed":true,"accepted_terms_version":1,"accepted_privacy_version":1}'),
  ('adad0000-0000-0000-0000-000000000002', 'ros@test.local',
   '{"handle":"ros","display_name":"Ros Begay","age_confirmed":true,"accepted_terms_version":1,"accepted_privacy_version":1}'),
  ('adad0000-0000-0000-0000-000000000003', 'amb@test.local',
   '{"handle":"ambrose_k","display_name":"Ambrose Kee","age_confirmed":true,"accepted_terms_version":1,"accepted_privacy_version":1}'),
  ('adad0000-0000-0000-0000-000000000004', 'pct@test.local',
   '{"handle":"pct_user","display_name":"100% Local","age_confirmed":true,"accepted_terms_version":1,"accepted_privacy_version":1}');

create function pg_temp.doc(t text) returns jsonb language sql as $$
  select jsonb_build_object('type', 'doc', 'content', jsonb_build_array(jsonb_build_object(
    'type', 'paragraph', 'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', t)))));
$$;

insert into public.articles (id, author_id, slug, title, dek, category, body_json, status, submitted_at, published_at) values
  ('adad0000-0000-0000-0000-0000000000a1', 'adad0000-0000-0000-0000-000000000001', 'rodeo-title',
   'Rodeo season opens', null, 'sports', pg_temp.doc('Bull riding and barrel racing all weekend.'), 'published', now(), now() - interval '2 days'),
  ('adad0000-0000-0000-0000-0000000000a2', 'adad0000-0000-0000-0000-000000000001', 'rodeo-body',
   'Weekend roundup', null, 'news', pg_temp.doc('The rodeo drew a crowd, and the farmers market sold out of chile.'), 'published', now(), now() - interval '1 day'),
  ('adad0000-0000-0000-0000-0000000000a3', 'adad0000-0000-0000-0000-000000000002', 'library-hours',
   'Library extends hours', 'Open until 8 p.m. on weekdays', 'community', pg_temp.doc('Starting Monday.'), 'published', now(), now());
insert into public.articles (author_id, slug, title, category, body_json, status, submitted_at, published_at, deleted_at) values
  ('adad0000-0000-0000-0000-000000000001', 'rodeo-deleted', 'Rodeo deleted story', 'news', pg_temp.doc('Rodeo.'), 'published', now(), now(), now()),
  ('adad0000-0000-0000-0000-000000000001', 'rodeo-pending', 'Rodeo pending story', 'news', pg_temp.doc('Rodeo.'), 'pending_review', now(), null, null);

set local role anon;
set local request.jwt.claims to '{"role":"anon"}';

-- Stories
select is((select array_agg(slug) from public.search_articles('rodeo')), '{rodeo-title,rodeo-body}'::text[],
  'title matches rank above body matches; hidden statuses excluded');
select is((select count(*)::int from public.search_articles('rodeos')), 2, 'stemming: "rodeos" finds "rodeo"');
select is((select array_agg(slug) from public.search_articles('RODEO -market')), '{rodeo-title}'::text[],
  'web-search syntax: -word excludes');
select is((select array_agg(slug) from public.search_articles('"farmers market"')), '{rodeo-body}'::text[],
  'quoted phrases');
select is((select array_agg(slug) from public.search_articles('weekdays')), '{library-hours}'::text[], 'the summary is searched');
select is((select count(*)::int from public.search_articles('')), 0, 'empty query returns nothing');
select is((select count(*)::int from public.search_articles('the and of')), 0, 'stop words only returns nothing');
select is((select count(*)::int from public.search_articles('weather')), 0, 'no match returns nothing');
select is((select array_agg(slug) from public.search_articles('rodeo', p_limit => 1, p_offset => 1)), '{rodeo-body}'::text[],
  'limit and offset page through results');
select is((select author_display_name from public.search_articles('library')), 'Ros Begay'::text,
  'results include the author');

-- Writers
select is((select array_agg(handle) from public.search_profiles('ros')), '{ros,rosa_y,ambrose_k}'::text[],
  'exact handle first, then prefix matches, then matches inside');
select is((select array_agg(handle) from public.search_profiles('@ROSA')), '{rosa_y}'::text[], '"@" and case are ignored');
select is((select array_agg(handle) from public.search_profiles('yazz')), '{rosa_y}'::text[], 'matches inside display names');
select is((select array_agg(handle) from public.search_profiles('kee')), '{ambrose_k}'::text[], 'matches the last name');
select is((select array_agg(handle) from public.search_profiles('%')), '{pct_user}'::text[], '"%" matches literally, not everything');
select ok(not exists (select 1 from public.search_profiles('_') where handle = 'ros'),
  '"_" matches literally, not any character');
select is((select count(*)::int from public.search_profiles('   ')), 0, 'blank query returns nothing');

select * from finish();
rollback;
