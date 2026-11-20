-- Articles, sources, images, submit/withdraw and limits (migration 20261119010000).
begin;
select plan(59);

-- Start from no stories (seed.sql and local e2e runs add some); rolled back at the end.
delete from public.articles;

-- Users: ana (new contributor), vet (3 approved stories), bo (another user),
-- sus (suspended), noterms (hasn't accepted Terms/Privacy), modtest (moderator).
insert into auth.users (id, email, raw_user_meta_data) values
  ('cccccccc-0000-0000-0000-000000000001', 'ana@test.local',
   '{"handle":"ana","display_name":"Ana","age_confirmed":true,"accepted_terms_version":2,"accepted_privacy_version":2}'),
  ('cccccccc-0000-0000-0000-000000000002', 'vet@test.local',
   '{"handle":"vet","display_name":"Vet","age_confirmed":true,"accepted_terms_version":2,"accepted_privacy_version":2}'),
  ('cccccccc-0000-0000-0000-000000000003', 'bo@test.local',
   '{"handle":"bo","display_name":"Bo","age_confirmed":true,"accepted_terms_version":2,"accepted_privacy_version":2}'),
  ('cccccccc-0000-0000-0000-000000000004', 'sus@test.local',
   '{"handle":"sus","display_name":"Sus","age_confirmed":true,"accepted_terms_version":2,"accepted_privacy_version":2}'),
  ('cccccccc-0000-0000-0000-000000000005', 'noterms@test.local',
   '{"handle":"noterms","display_name":"No Terms","age_confirmed":true}'),
  ('cccccccc-0000-0000-0000-000000000006', 'mod@test.local',
   '{"handle":"modtest","display_name":"Mod","age_confirmed":true,"accepted_terms_version":2,"accepted_privacy_version":2}');
update public.profiles set approved_article_count = 3 where handle = 'vet';
update public.profiles set suspended_until = now() + interval '1 day' where handle = 'sus';
update public.profiles set role = 'moderator' where handle = 'modtest';

-- Helper for this test only: create a complete draft + contributor acceptance
-- as the current user, return its id.
create function pg_temp.ready_draft(t text) returns uuid language plpgsql as $$
declare new_id uuid;
begin
  insert into public.articles (title, category, body_json)
  values (t, 'news', '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Body."}]}]}')
  returning id into new_id;
  insert into public.agreement_acceptances (kind, version, article_id) values ('contributor', 1, new_id);
  return new_id;
end;
$$;
grant execute on function pg_temp.ready_draft(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Text helpers
-- ---------------------------------------------------------------------------
select is(public.slugify('Café Día: Gallup''s 4th of July!'), 'cafe-dia-gallup-s-4th-of-july',
  'slugify strips accents and punctuation');
select is(public.slugify('¿¡!?'), '', 'slugify can return empty');
select is(
  public.richtext_plain('{"type":"doc","content":[
    {"type":"paragraph","content":[{"type":"text","text":"Hel"},{"type":"text","text":"lo","marks":[{"type":"bold"}]}]},
    {"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"one"}]}]}]}
  ]}'::jsonb),
  E'Hello\none', 'richtext_plain joins inline text and separates blocks');

-- ---------------------------------------------------------------------------
-- Categories and anon
-- ---------------------------------------------------------------------------
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select is((select count(*)::int from public.categories), 8, 'anon can read the 8 categories');
select throws_ok($$insert into public.categories (slug, name, sort) values ('x-y', 'X', 99)$$,
  '42501', null, 'clients cannot add categories');
select throws_ok($$insert into public.articles (title) values ('Anon story')$$,
  '42501', null, 'anon cannot create articles');
select throws_ok($$select public.submit_article(gen_random_uuid())$$,
  '42501', null, 'anon cannot call submit_article');

-- ---------------------------------------------------------------------------
-- Drafts (ana)
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"cccccccc-0000-0000-0000-000000000001","role":"authenticated"}';
select lives_ok(
  $$insert into public.articles (title, dek, category, content_type, body_json) values (
    'Hello Gallup', 'A first story', 'community', 'community',
    '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Rodeo season starts Friday."}]}]}')$$,
  'writer can create a draft');
select is(
  (select row(status, author_id, slug)::text from public.articles where title = 'Hello Gallup'),
  '(draft,cccccccc-0000-0000-0000-000000000001,)', 'draft is owned by the caller, with no slug yet');
select is((select body_text from public.articles where title = 'Hello Gallup'),
  'Rodeo season starts Friday.', 'body_text is derived from body_json');
select ok((select search @@ to_tsquery('english', 'rodeo') from public.articles where title = 'Hello Gallup'),
  'search vector covers the body');
select throws_ok($$insert into public.articles (title, status) values ('Sneaky', 'published')$$,
  '42501', null, 'clients cannot set status on insert');
select throws_ok(
  $$insert into public.articles (title, author_id) values ('Forged', 'cccccccc-0000-0000-0000-000000000003')$$,
  '42501', null, 'clients cannot set the author');
select throws_ok($$update public.articles set status = 'published' where title = 'Hello Gallup'$$,
  '42501', null, 'clients cannot change status directly');
select throws_ok($$update public.articles set comments_locked = true where title = 'Hello Gallup'$$,
  '42501', null, 'clients cannot lock comments');
select throws_ok($$update public.articles set slug = 'my-slug' where title = 'Hello Gallup'$$,
  '42501', null, 'clients cannot set the slug');
select throws_ok($$insert into public.articles (title, category) values ('Bad category', 'weather')$$,
  '23503', null, 'category must exist');
select throws_ok($$insert into public.articles (title) values (repeat('x', 121))$$,
  '23514', null, 'headline is at most 120 characters');

-- Sources
select lives_ok(
  $$insert into public.article_sources (article_id, position, url, label)
    select id, 0, 'https://www.gallupnm.gov/', 'City of Gallup' from public.articles where title = 'Hello Gallup'$$,
  'author can add an http(s) source');
select throws_ok(
  $$insert into public.article_sources (article_id, position, url)
    select id, 1, 'javascript:alert(1)' from public.articles where title = 'Hello Gallup'$$,
  '23514', null, 'non-http source URLs are rejected');

-- Images
select lives_ok(
  $$insert into public.article_images (article_id, position, storage_path, alt_text, caption, credit)
    select id, 0, 'cccccccc-0000-0000-0000-000000000001/' || id || '/photo-1.webp', 'Rodeo arena', 'The arena', 'Ana'
    from public.articles where title = 'Hello Gallup'$$,
  'author can attach an image in their folder');
select throws_ok(
  $$insert into public.article_images (article_id, position, storage_path)
    select id, 3, 'cccccccc-0000-0000-0000-000000000001/' || id || '/photo-4.webp'
    from public.articles where title = 'Hello Gallup'$$,
  '23514', null, 'at most 3 images (positions 0-2)');
select throws_ok(
  $$insert into public.article_images (article_id, position, storage_path)
    select id, 1, 'cccccccc-0000-0000-0000-000000000003/' || id || '/photo-2.webp'
    from public.articles where title = 'Hello Gallup'$$,
  '42501', null, 'image path must be in the author''s folder');
select throws_ok(
  $$insert into public.article_images (article_id, position, storage_path)
    select id, 1, 'cccccccc-0000-0000-0000-000000000001/00000000-0000-0000-0000-000000000000/photo-2.webp'
    from public.articles where title = 'Hello Gallup'$$,
  '23514', null, 'image path must name its article');
select lives_ok(
  $$insert into storage.objects (bucket_id, name, owner_id)
    select 'article-images', 'cccccccc-0000-0000-0000-000000000001/' || id || '/photo-1.webp',
           'cccccccc-0000-0000-0000-000000000001'
    from public.articles where title = 'Hello Gallup'$$,
  'author can upload into their article''s folder');
select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner_id)
    values ('article-images', 'cccccccc-0000-0000-0000-000000000001/not-a-uuid/x.webp',
            'cccccccc-0000-0000-0000-000000000001')$$,
  '42501', null, 'uploads need a real article folder');

-- ---------------------------------------------------------------------------
-- Other users can't see or touch the draft
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"cccccccc-0000-0000-0000-000000000003","role":"authenticated"}';
select is((select count(*)::int from public.articles where title = 'Hello Gallup'), 0,
  'other users cannot see a draft');
select is((select count(*)::int from public.article_images), 0, 'other users cannot see a draft''s images');
select is((select count(*)::int from public.article_sources), 0, 'other users cannot see a draft''s sources');
update public.articles set title = 'Defaced' where author_id = 'cccccccc-0000-0000-0000-000000000001';
reset role;
select is((select count(*)::int from public.articles where title = 'Defaced'), 0,
  'other users cannot edit a draft');

-- Remember ana's story id for the cross-user checks below.
select set_config('test.ana_article', (select id::text from public.articles where title = 'Hello Gallup'), true);

set local role authenticated;
select throws_ok(
  $$insert into public.agreement_acceptances (kind, version, article_id)
    values ('contributor', 1, current_setting('test.ana_article')::uuid)$$,
  '42501', null, 'cannot accept the Contributor Agreement for someone else''s story');
select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner_id)
    values ('article-images',
            'cccccccc-0000-0000-0000-000000000003/' || current_setting('test.ana_article') || '/x.webp',
            'cccccccc-0000-0000-0000-000000000003')$$,
  '42501', null, 'cannot upload into a folder for someone else''s story');
select throws_ok($$select public.submit_article(current_setting('test.ana_article')::uuid)$$,
  'P0002', null, 'cannot submit someone else''s story');

set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select is((select count(*)::int from public.articles), 0, 'anon cannot see drafts');

-- ---------------------------------------------------------------------------
-- Submit: a new contributor goes to review
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"cccccccc-0000-0000-0000-000000000001","role":"authenticated"}';
select throws_ok($$select public.submit_article(current_setting('test.ana_article')::uuid)$$,
  '42501', 'Accept the Contributor Agreement to publish', 'submitting needs the Contributor Agreement');
select lives_ok(
  $$insert into public.agreement_acceptances (kind, version, article_id)
    values ('contributor', 1, current_setting('test.ana_article')::uuid)$$,
  'author accepts the Contributor Agreement for their story');
select is(public.submit_article(current_setting('test.ana_article')::uuid),
  'pending_review'::public.article_status, 'a new contributor''s story goes to review');
select matches((select slug from public.articles where title = 'Hello Gallup'),
  '^hello-gallup-[0-9a-f]{6}$', 'submitting assigns a slug');
select throws_ok($$select public.submit_article(current_setting('test.ana_article')::uuid)$$,
  '55000', null, 'a story cannot be submitted twice');
delete from public.articles where title = 'Hello Gallup';
select is((select count(*)::int from public.articles where title = 'Hello Gallup'), 1,
  'submitted stories cannot be hard-deleted');
select lives_ok($$update public.articles set dek = 'Updated dek' where title = 'Hello Gallup'$$,
  'author can keep editing while in review');

set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select is((select count(*)::int from public.articles), 0, 'anon cannot see stories waiting for review');

set local role authenticated;
set local request.jwt.claims to '{"sub":"cccccccc-0000-0000-0000-000000000006","role":"authenticated"}';
select is((select count(*)::int from public.articles where status = 'pending_review'), 1,
  'staff can see the review queue');

set local request.jwt.claims to '{"sub":"cccccccc-0000-0000-0000-000000000001","role":"authenticated"}';
select is(public.withdraw_article(current_setting('test.ana_article')::uuid),
  'draft'::public.article_status, 'author can withdraw a story from review');
select throws_ok($$select public.withdraw_article(current_setting('test.ana_article')::uuid)$$,
  '55000', null, 'only stories in review can be withdrawn');

-- Incomplete drafts can't be submitted
insert into public.articles (title) values ('No category or body');
insert into public.agreement_acceptances (kind, version, article_id)
  select 'contributor', 1, id from public.articles where title = 'No category or body';
select throws_ok(
  $$select public.submit_article((select id from public.articles where title = 'No category or body'))$$,
  '23514', 'Choose a category', 'incomplete drafts cannot be submitted');
select lives_ok($$delete from public.articles where title = 'No category or body'$$,
  'author can delete an unsubmitted draft');
select is((select count(*)::int from public.agreement_acceptances where kind = 'contributor'), 1,
  'deleting a draft removes its acceptance rows');

-- ---------------------------------------------------------------------------
-- Submit: an experienced contributor publishes directly; daily limit
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"cccccccc-0000-0000-0000-000000000002","role":"authenticated"}';
select is(public.submit_article(pg_temp.ready_draft('Vet story one')),
  'published'::public.article_status, 'an experienced contributor publishes directly');
select ok((select published_at is not null from public.articles where title = 'Vet story one'),
  'published stories get a publish date');
select lives_ok($$update public.articles set title = 'Vet story one (updated)' where title = 'Vet story one'$$,
  'author can edit a published story');

insert into public.article_images (article_id, position, storage_path)
  select id, 0, 'cccccccc-0000-0000-0000-000000000002/' || id || '/lead.webp'
  from public.articles where title = 'Vet story one (updated)';

select lives_ok(
  $$select public.submit_article(pg_temp.ready_draft('Vet story ' || n)) from generate_series(2, 5) n$$,
  'five stories in a day are allowed');
select throws_ok($$select public.submit_article(pg_temp.ready_draft('Vet story six'))$$,
  'PT429', null, 'the sixth story in 24 hours is refused');

set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select is((select count(*)::int from public.articles where status = 'published'), 5,
  'anon sees published stories');
select is((select count(*)::int from public.article_images), 1, 'anon sees a published story''s images');
select is((select count(*)::int from public.article_sources), 0, 'anon still cannot see draft sources');

-- ---------------------------------------------------------------------------
-- Blocked writers and the draft cap
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"cccccccc-0000-0000-0000-000000000004","role":"authenticated"}';
select throws_ok($$insert into public.articles (title) values ('Suspended story')$$,
  '42501', null, 'suspended users cannot create stories');

set local request.jwt.claims to '{"sub":"cccccccc-0000-0000-0000-000000000005","role":"authenticated"}';
select throws_ok($$insert into public.articles (title) values ('No terms story')$$,
  '42501', null, 'users who have not accepted the Terms cannot create stories');

set local request.jwt.claims to '{"sub":"cccccccc-0000-0000-0000-000000000003","role":"authenticated"}';
insert into public.articles (title) select 'Draft ' || n from generate_series(1, 20) n;
select throws_ok($$insert into public.articles (title) values ('Draft 21')$$,
  'PT429', null, 'at most 20 open drafts');

select * from finish();
rollback;
