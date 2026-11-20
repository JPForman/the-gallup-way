-- Article revisions and corrections (migration 20261119030000).
begin;
select plan(30);

-- Start from no stories (seed.sql and local e2e runs add some); rolled back at the end.
delete from public.articles;

-- Users: ana (author), bo (another user), sus (suspended author), mod (moderator).
insert into auth.users (id, email, raw_user_meta_data) values
  ('dddddddd-0000-0000-0000-000000000001', 'ana@test.local',
   '{"handle":"ana","display_name":"Ana","age_confirmed":true,"accepted_terms_version":2,"accepted_privacy_version":2}'),
  ('dddddddd-0000-0000-0000-000000000002', 'bo@test.local',
   '{"handle":"bo","display_name":"Bo","age_confirmed":true,"accepted_terms_version":2,"accepted_privacy_version":2}'),
  ('dddddddd-0000-0000-0000-000000000003', 'sus@test.local',
   '{"handle":"sus","display_name":"Sus","age_confirmed":true,"accepted_terms_version":2,"accepted_privacy_version":2}'),
  ('dddddddd-0000-0000-0000-000000000004', 'mod@test.local',
   '{"handle":"modtest","display_name":"Mod","age_confirmed":true,"accepted_terms_version":2,"accepted_privacy_version":2}');
update public.profiles set role = 'moderator' where handle = 'modtest';

-- Fixtures (as the table owner): a published story, a draft, a pending story
-- (all by ana), and a published story by sus.
insert into public.articles (id, author_id, slug, title, dek, category, body_json, status, submitted_at, published_at) values
  ('eeeeeeee-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-000000000001', 'fair-opens-eeeeee',
   'County fair opens', 'Gates at nine', 'events',
   '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Original."}]}]}',
   'published', now(), now()),
  ('eeeeeeee-0000-0000-0000-000000000002', 'dddddddd-0000-0000-0000-000000000001', null,
   'Draft story', null, 'news',
   '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Draft."}]}]}',
   'draft', null, null),
  ('eeeeeeee-0000-0000-0000-000000000003', 'dddddddd-0000-0000-0000-000000000001', 'pending-eeeeee',
   'Pending story', null, 'news',
   '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Pending."}]}]}',
   'pending_review', now(), null),
  ('eeeeeeee-0000-0000-0000-000000000004', 'dddddddd-0000-0000-0000-000000000003', 'sus-story-eeeeee',
   'Suspended author story', null, 'news',
   '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Sus."}]}]}',
   'published', now(), now());
update public.profiles set suspended_until = now() + interval '1 day' where handle = 'sus';

-- ---------------------------------------------------------------------------
-- Revisions (ana edits her own stories)
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"dddddddd-0000-0000-0000-000000000001","role":"authenticated"}';

update public.articles set title = 'Draft story v2' where id = 'eeeeeeee-0000-0000-0000-000000000002';
update public.articles set title = 'Pending story v2' where id = 'eeeeeeee-0000-0000-0000-000000000003';
reset role;
select is((select count(*)::int from public.article_revisions), 0,
  'edits before publishing are not snapshotted');

set local role authenticated;
update public.articles set category = 'community' where id = 'eeeeeeee-0000-0000-0000-000000000001';
reset role;
select is((select count(*)::int from public.article_revisions), 0,
  'changing only the category is not a revision');

set local role authenticated;
update public.articles set title = title, dek = dek, body_json = body_json
  where id = 'eeeeeeee-0000-0000-0000-000000000001';
reset role;
select is((select count(*)::int from public.article_revisions), 0,
  'a save with no content change is not a revision');

set local role authenticated;
select lives_ok(
  $$select public.save_article(
    p_article_id => 'eeeeeeee-0000-0000-0000-000000000001',
    p_title => 'County fair opens Friday',
    p_dek => 'Gates at nine',
    p_body_json => '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Updated."}]}]}',
    p_category => 'events',
    p_content_type => 'event')$$,
  'author can edit a published story');
reset role;
select is((select count(*)::int from public.article_revisions), 1,
  'editing a published story snapshots one revision');
select is(
  (select row(title, dek, richtext_plain(body_json), edited_by)::text from public.article_revisions),
  '("County fair opens","Gates at nine",Original.,dddddddd-0000-0000-0000-000000000001)',
  'the revision holds the previous content and the editor');

set local role authenticated;
update public.articles set dek = 'Gates at ten' where id = 'eeeeeeee-0000-0000-0000-000000000001';
reset role;
select is(
  (select array_agg(dek order by id)::text from public.article_revisions),
  '{"Gates at nine","Gates at nine"}', 'each later change adds another snapshot');

set local role authenticated;
select is((select count(*)::int from public.article_revisions), 0, 'authors cannot read revisions');
select throws_ok(
  $$insert into public.article_revisions (article_id, title, body_json)
    values ('eeeeeeee-0000-0000-0000-000000000001', 'Fake', '{"type":"doc","content":[]}')$$,
  '42501', null, 'clients cannot insert revisions');
select throws_ok($$update public.article_revisions set title = 'x'$$, '42501', null, 'clients cannot update revisions');
select throws_ok($$delete from public.article_revisions$$, '42501', null, 'clients cannot delete revisions');
reset role;
select is((select count(*)::int from public.article_revisions where title <> 'x'), 2,
  'revisions were not changed or deleted by the author');

set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select throws_ok($$select count(*) from public.article_revisions$$,
  '42501', null, 'anon cannot read revisions');

set local role authenticated;
set local request.jwt.claims to '{"sub":"dddddddd-0000-0000-0000-000000000004","role":"authenticated"}';
select is((select count(*)::int from public.article_revisions), 2, 'staff can read revisions');

-- ---------------------------------------------------------------------------
-- Corrections
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"dddddddd-0000-0000-0000-000000000001","role":"authenticated"}';
select lives_ok(
  $$insert into public.corrections (article_id, body)
    values ('eeeeeeee-0000-0000-0000-000000000001', '  The fair opens Friday, not Thursday.  ')$$,
  'author can correct a published story');
select is(
  (select row(body, created_by)::text from public.corrections),
  '("The fair opens Friday, not Thursday.",dddddddd-0000-0000-0000-000000000001)',
  'correction is trimmed and owned by the caller');
select throws_ok(
  $$insert into public.corrections (article_id, body, created_by)
    values ('eeeeeeee-0000-0000-0000-000000000001', 'Forged', 'dddddddd-0000-0000-0000-000000000002')$$,
  '42501', null, 'clients cannot set created_by');
select throws_ok(
  $$insert into public.corrections (article_id, body)
    values ('eeeeeeee-0000-0000-0000-000000000002', 'On a draft')$$,
  '42501', null, 'drafts cannot get corrections');
select throws_ok(
  $$insert into public.corrections (article_id, body)
    values ('eeeeeeee-0000-0000-0000-000000000003', 'On a pending story')$$,
  '42501', null, 'pending stories cannot get corrections');
select throws_ok(
  $$insert into public.corrections (article_id, body) values ('eeeeeeee-0000-0000-0000-000000000001', '   ')$$,
  '23514', null, 'a correction cannot be blank');
select throws_ok(
  $$insert into public.corrections (article_id, body)
    values ('eeeeeeee-0000-0000-0000-000000000001', repeat('x', 1001))$$,
  '23514', null, 'a correction is at most 1000 characters');
select throws_ok($$update public.corrections set body = 'Changed'$$, '42501', null, 'clients cannot update corrections');
select throws_ok($$delete from public.corrections$$, '42501', null, 'clients cannot delete corrections');
reset role;
select is((select body from public.corrections), 'The fair opens Friday, not Thursday.',
  'corrections are append-only');

-- Another user cannot correct ana's story; a suspended author cannot correct theirs.
set local role authenticated;
set local request.jwt.claims to '{"sub":"dddddddd-0000-0000-0000-000000000002","role":"authenticated"}';
select throws_ok(
  $$insert into public.corrections (article_id, body) values ('eeeeeeee-0000-0000-0000-000000000001', 'Not mine')$$,
  '42501', null, 'other users cannot correct a story');
set local request.jwt.claims to '{"sub":"dddddddd-0000-0000-0000-000000000003","role":"authenticated"}';
select throws_ok(
  $$insert into public.corrections (article_id, body) values ('eeeeeeee-0000-0000-0000-000000000004', 'Suspended')$$,
  '42501', null, 'suspended authors cannot add corrections');

-- Staff can correct any published story.
set local request.jwt.claims to '{"sub":"dddddddd-0000-0000-0000-000000000004","role":"authenticated"}';
select lives_ok(
  $$insert into public.corrections (article_id, body)
    values ('eeeeeeee-0000-0000-0000-000000000001', 'Moderator note: the date was corrected.')$$,
  'staff can correct a published story');

-- Public reads follow the story's visibility.
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select is((select count(*)::int from public.corrections), 2, 'anon sees corrections on published stories');
reset role;
update public.articles set status = 'hidden' where id = 'eeeeeeee-0000-0000-0000-000000000001';
set local role anon;
select is((select count(*)::int from public.corrections), 0, 'corrections on hidden stories are not public');

-- Daily limit: 10 per user per 24 hours.
reset role;
update public.articles set status = 'published' where id = 'eeeeeeee-0000-0000-0000-000000000001';
insert into public.corrections (article_id, body, created_by)
  select 'eeeeeeee-0000-0000-0000-000000000001', 'Filler ' || g, 'dddddddd-0000-0000-0000-000000000001'
  from generate_series(1, 9) g;
set local role authenticated;
set local request.jwt.claims to '{"sub":"dddddddd-0000-0000-0000-000000000001","role":"authenticated"}';
select throws_ok(
  $$insert into public.corrections (article_id, body) values ('eeeeeeee-0000-0000-0000-000000000001', 'Eleventh')$$,
  'PT429', null, 'at most 10 corrections per user per day');

select * from finish();
rollback;
