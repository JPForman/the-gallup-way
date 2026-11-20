-- articles.edited_at (migration 20261120000000).
begin;
select plan(6);

insert into auth.users (id, email, raw_user_meta_data) values
  ('ffffffff-0000-0000-0000-000000000001', 'ed@test.local',
   '{"handle":"edtest","display_name":"Ed","age_confirmed":true,"accepted_terms_version":2,"accepted_privacy_version":2}');

insert into public.articles (id, author_id, slug, title, category, body_json, status, submitted_at, published_at) values
  ('ffffffff-0000-0000-0000-0000000000a1', 'ffffffff-0000-0000-0000-000000000001', 'live-ffffff',
   'Live story', 'news', '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Live."}]}]}',
   'published', now(), now());

set local role authenticated;
set local request.jwt.claims to '{"sub":"ffffffff-0000-0000-0000-000000000001","role":"authenticated"}';

select lives_ok(
  $$insert into public.articles (title) values ('Fresh draft')$$, 'writer creates a draft');
update public.articles set title = 'Fresh draft v2' where title = 'Fresh draft';
select is((select edited_at from public.articles where title = 'Fresh draft v2'), null,
  'draft edits do not set edited_at');

update public.articles set category = 'community' where slug = 'live-ffffff';
select is((select edited_at from public.articles where slug = 'live-ffffff'), null,
  'non-content changes do not set edited_at');

update public.articles set title = 'Live story, updated' where slug = 'live-ffffff';
select isnt((select edited_at from public.articles where slug = 'live-ffffff'), null,
  'content edits after publishing set edited_at');

select throws_ok($$update public.articles set edited_at = null where slug = 'live-ffffff'$$,
  '42501', null, 'clients cannot set edited_at');
select throws_ok($$insert into public.articles (title, edited_at) values ('Backdated', now())$$,
  '42501', null, 'clients cannot set edited_at on insert');

select * from finish();
rollback;
