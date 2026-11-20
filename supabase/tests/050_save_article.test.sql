-- save_article(): atomic content + sources + images save (migration 20261119020000).
begin;
select plan(16);

insert into auth.users (id, email, raw_user_meta_data) values
  ('dddddddd-0000-0000-0000-000000000001', 'sam@test.local',
   '{"handle":"samsave","display_name":"Sam","age_confirmed":true,"accepted_terms_version":2,"accepted_privacy_version":2}'),
  ('dddddddd-0000-0000-0000-000000000002', 'lee@test.local',
   '{"handle":"leesave","display_name":"Lee","age_confirmed":true,"accepted_terms_version":2,"accepted_privacy_version":2}'),
  ('dddddddd-0000-0000-0000-000000000003', 'kit@test.local',
   '{"handle":"kitsave","display_name":"Kit","age_confirmed":true,"accepted_terms_version":2,"accepted_privacy_version":2}');
update public.profiles set suspended_until = now() + interval '1 day' where handle = 'kitsave';

set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select throws_ok(
  $$select public.save_article(null, 'x', null, null, null, 'news')$$,
  '42501', null, 'anon cannot save');

set local role authenticated;
set local request.jwt.claims to '{"sub":"dddddddd-0000-0000-0000-000000000001","role":"authenticated"}';

select set_config('test.id',
  (public.save_article(null, 'Fair week', 'Dek', '{"type":"doc","content":[]}', 'events', 'event') ->> 'id'),
  true);
select is((select title from public.articles where id = current_setting('test.id')::uuid), 'Fair week',
  'creates a draft when no id is given');
select is((select status::text from public.articles where id = current_setting('test.id')::uuid), 'draft',
  'new stories are drafts');

select is(
  public.save_article(
    current_setting('test.id')::uuid, 'Fair week schedule', null,
    '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Gates open at 9."}]}]}',
    'events', 'event',
    '[{"url":"https://example.com/a","label":"Fair board"},{"url":"https://example.com/b","label":""}]',
    jsonb_build_array(
      jsonb_build_object('storage_path', 'dddddddd-0000-0000-0000-000000000001/' || current_setting('test.id') || '/one.webp',
                         'alt_text', 'Ferris wheel', 'caption', 'Opening night', 'credit', 'Sam'),
      jsonb_build_object('storage_path', 'dddddddd-0000-0000-0000-000000000001/' || current_setting('test.id') || '/two.webp',
                         'alt_text', 'Crowd', 'caption', '', 'credit', ''))
  ) -> 'removed_paths',
  '[]'::jsonb, 'saves content, sources and images');
select is((select body_text from public.articles where id = current_setting('test.id')::uuid), 'Gates open at 9.',
  'body text is derived');
select is(
  (select array_agg(url || '|' || coalesce(label, '-') order by position) from public.article_sources
   where article_id = current_setting('test.id')::uuid),
  array['https://example.com/a|Fair board', 'https://example.com/b|-'], 'sources saved in order; empty labels become null');
select is(
  (select array_agg(alt_text || '|' || coalesce(caption, '-') order by position) from public.article_images
   where article_id = current_setting('test.id')::uuid),
  array['Ferris wheel|Opening night', 'Crowd|-'], 'images saved in order');

-- Drop the first image and reorder.
select is(
  public.save_article(
    current_setting('test.id')::uuid, 'Fair week schedule', null, '{"type":"doc","content":[]}', 'events', 'event',
    '[]',
    jsonb_build_array(jsonb_build_object(
      'storage_path', 'dddddddd-0000-0000-0000-000000000001/' || current_setting('test.id') || '/two.webp',
      'alt_text', 'Crowd')))
  -> 'removed_paths',
  jsonb_build_array('dddddddd-0000-0000-0000-000000000001/' || current_setting('test.id') || '/one.webp'),
  'reports image files that are no longer used');
select is(
  (select array_agg(position::int || ':' || alt_text) from public.article_images
   where article_id = current_setting('test.id')::uuid),
  array['0:Crowd'], 'remaining image moves to the first position');
select is((select count(*)::int from public.article_sources where article_id = current_setting('test.id')::uuid), 0,
  'sources can be cleared');

select throws_ok(
  format($$select public.save_article(%L, 't', null, null, 'news', 'news',
    (select jsonb_agg(jsonb_build_object('url', 'https://example.com/' || n)) from generate_series(1, 11) n))$$,
    current_setting('test.id')),
  '23514', 'A story can have at most 10 sources', 'at most 10 sources');
select throws_ok(
  format($$select public.save_article(%L, 't', null, null, 'news', 'news', '[{"url":"ftp://x.test"}]')$$,
    current_setting('test.id')),
  '23514', null, 'bad source URLs are rejected');
select is((select title from public.articles where id = current_setting('test.id')::uuid), 'Fair week schedule',
  'a failed save changes nothing');

-- Someone else
set local request.jwt.claims to '{"sub":"dddddddd-0000-0000-0000-000000000002","role":"authenticated"}';
select throws_ok(
  format($$select public.save_article(%L, 'Hijacked', null, null, 'news', 'news')$$, current_setting('test.id')),
  'P0002', null, 'cannot save someone else''s story');
select throws_ok(
  $$select public.save_article(null, 'Elsewhere', null, null, 'news', 'news', '[]',
    '[{"storage_path":"dddddddd-0000-0000-0000-000000000002/00000000-0000-0000-0000-000000000000/x.webp","alt_text":"x"}]')$$,
  '23514', null, 'images on a brand-new story are rejected (no folder yet)');

set local request.jwt.claims to '{"sub":"dddddddd-0000-0000-0000-000000000003","role":"authenticated"}';
select throws_ok($$select public.save_article(null, 'Suspended', null, null, 'news', 'news')$$,
  '42501', null, 'suspended users cannot save');

select * from finish();
rollback;
