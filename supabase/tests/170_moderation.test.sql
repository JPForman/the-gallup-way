-- Reports, moderation log and staff actions (migration 20261123000000).
begin;
select plan(47);

delete from public.articles;

-- reader, author, mod (moderator), admin, mod2 (moderator)
insert into auth.users (id, email, raw_user_meta_data) values
  ('e0e00000-0000-0000-0000-000000000001', 'mreader@test.local',
   '{"handle":"mreader","display_name":"Reader","age_confirmed":true,"accepted_terms_version":1,"accepted_privacy_version":1}'),
  ('e0e00000-0000-0000-0000-000000000002', 'mauthor@test.local',
   '{"handle":"mauthor","display_name":"Author","age_confirmed":true,"accepted_terms_version":1,"accepted_privacy_version":1}'),
  ('e0e00000-0000-0000-0000-000000000003', 'mmod@test.local',
   '{"handle":"mmod","display_name":"Mod","age_confirmed":true,"accepted_terms_version":1,"accepted_privacy_version":1}'),
  ('e0e00000-0000-0000-0000-000000000004', 'madmin@test.local',
   '{"handle":"madmin","display_name":"Admin","age_confirmed":true,"accepted_terms_version":1,"accepted_privacy_version":1}'),
  ('e0e00000-0000-0000-0000-000000000005', 'mmod2@test.local',
   '{"handle":"mmod2","display_name":"Mod Two","age_confirmed":true,"accepted_terms_version":1,"accepted_privacy_version":1}');
update public.profiles set role = 'moderator' where handle in ('mmod', 'mmod2');
update public.profiles set role = 'admin' where handle = 'madmin';

insert into public.articles (id, author_id, slug, title, category, body_json, status, submitted_at, published_at) values
  ('e0e00000-0000-0000-0000-0000000000a1', 'e0e00000-0000-0000-0000-000000000002', 'm-pub', 'Moderation published story', 'news',
   '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"x"}]}]}', 'published', now(), now() - interval '1 day');
insert into public.articles (id, author_id, slug, title, category, body_json, status, submitted_at) values
  ('e0e00000-0000-0000-0000-0000000000a2', 'e0e00000-0000-0000-0000-000000000002', 'm-pending', 'Moderation pending story', 'news',
   '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"x"}]}]}', 'pending_review', now()),
  ('e0e00000-0000-0000-0000-0000000000a3', 'e0e00000-0000-0000-0000-000000000002', 'm-pending2', 'Moderation second pending', 'news',
   '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"x"}]}]}', 'pending_review', now());
insert into public.comments (id, article_id, author_id, body) overriding system value values
  (900001, 'e0e00000-0000-0000-0000-0000000000a1', 'e0e00000-0000-0000-0000-000000000002', 'A rude comment');

-- ---------------------------------------------------------------------------
-- Reports (as the reader)
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"e0e00000-0000-0000-0000-000000000001","role":"authenticated"}';

select lives_ok($$insert into public.reports (target_type, article_id, reason) values ('article', 'e0e00000-0000-0000-0000-0000000000a1', 'defamation')$$,
  'report a story');
select is((select priority from public.reports where article_id = 'e0e00000-0000-0000-0000-0000000000a1'), 'high',
  'defamation reports are high priority');
select throws_ok($$insert into public.reports (target_type, article_id, reason) values ('article', 'e0e00000-0000-0000-0000-0000000000a1', 'spam')$$,
  '23505', null, 'one open report per item per reporter');
select lives_ok($$insert into public.reports (target_type, comment_id, reason) values ('comment', 900001, 'harassment')$$, 'report a comment');
select is((select priority from public.reports where comment_id = 900001), 'normal', 'harassment reports are normal priority');
select lives_ok($$insert into public.reports (target_type, profile_id, reason, details) values ('profile', 'e0e00000-0000-0000-0000-000000000002', 'other', '  Impersonating someone  ')$$,
  'report a profile with details');
select is((select details from public.reports where profile_id = 'e0e00000-0000-0000-0000-000000000002'), 'Impersonating someone',
  'details are trimmed');
select throws_ok($$insert into public.reports (target_type, profile_id, reason) values ('profile', 'e0e00000-0000-0000-0000-000000000003', 'other')$$,
  '23514', null, '"other" needs details');
select throws_ok($$insert into public.reports (target_type, article_id, comment_id, reason) values ('article', 'e0e00000-0000-0000-0000-0000000000a1', 900001, 'spam')$$,
  '23514', null, 'a report has exactly one target');
select throws_ok($$insert into public.reports (target_type, article_id, reason) values ('article', 'e0e00000-0000-0000-0000-0000000000a2', 'spam')$$,
  '42501', null, 'items you cannot see cannot be reported');
select throws_ok($$update public.reports set status = 'dismissed'$$, '42501', null, 'reporters cannot change reports');
select is((select count(*)::int from public.reports), 3, 'reporters see their own reports');

-- The author sees none of them, and can't read the log or call staff functions.
set local request.jwt.claims to '{"sub":"e0e00000-0000-0000-0000-000000000002","role":"authenticated"}';
select is((select count(*)::int from public.reports), 0, 'other users cannot see reports');
select throws_ok($$select public.staff_article_action('e0e00000-0000-0000-0000-0000000000a1', 'hide', 'x')$$,
  '42501', null, 'non-staff cannot hide stories');
select throws_ok($$select public.mod_log('note', 'x')$$, '42501', null, 'clients cannot write the log directly');
select throws_ok($$insert into public.moderation_actions (action, reason) values ('note', 'x')$$, '42501', null, 'no direct log inserts');

-- ---------------------------------------------------------------------------
-- Staff actions (as the moderator)
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"e0e00000-0000-0000-0000-000000000003","role":"authenticated"}';
select is((select count(*)::int from public.reports where status = 'open'), 3, 'staff see every report');
select throws_ok($$select public.staff_article_action('e0e00000-0000-0000-0000-0000000000a1', 'hide', '  ')$$,
  '22023', null, 'a reason is required');
select is(public.staff_article_action('e0e00000-0000-0000-0000-0000000000a1', 'hide', 'Unsupported allegation'),
  'hidden'::public.article_status, 'staff hide a story');
select is((select status::text from public.reports where article_id = 'e0e00000-0000-0000-0000-0000000000a1'), 'resolved',
  'hiding closes the story''s open reports');
select is((select row(action, reason, details ->> 'from', details ->> 'to')::text from public.moderation_actions
           where article_id = 'e0e00000-0000-0000-0000-0000000000a1' order by id desc limit 1),
  '(hide_article,"Unsupported allegation",published,hidden)', 'the hide is logged with a reason');
select is(public.staff_article_action('e0e00000-0000-0000-0000-0000000000a1', 'restore', 'Sources added'),
  'published'::public.article_status, 'restore returns a published story to published');
select throws_ok($$select public.staff_article_action('e0e00000-0000-0000-0000-0000000000a1', 'approve', 'x')$$,
  '55000', null, 'only pending stories can be approved');
select is(public.staff_article_action('e0e00000-0000-0000-0000-0000000000a2', 'approve', 'Looks good'),
  'published'::public.article_status, 'staff approve a pending story');
select ok((select published_at is not null from public.articles where id = 'e0e00000-0000-0000-0000-0000000000a2'),
  'approval sets the publish date');
reset role;
select is((select approved_article_count from public.profiles where handle = 'mauthor'), 1,
  'approval counts toward direct publishing');
set local role authenticated;
select is(public.staff_article_action('e0e00000-0000-0000-0000-0000000000a3', 'reject', 'Needs a source'),
  'draft'::public.article_status, 'staff reject a pending story back to draft');
select is(public.staff_article_action('e0e00000-0000-0000-0000-0000000000a1', 'lock_comments', 'Heated thread'),
  'published'::public.article_status, 'staff lock comments');
select ok((select comments_locked from public.articles where id = 'e0e00000-0000-0000-0000-0000000000a1'), 'comments are locked');
select throws_ok($$select public.staff_article_action('e0e00000-0000-0000-0000-0000000000a1', 'delete', 'x')$$,
  '22023', null, 'unknown actions are rejected');

select ok(public.staff_comment_action(900001, 'remove', 'Personal attack'), 'staff remove a comment');
select is((select row(body, deleted_at is not null, removed_at is not null)::text from public.comments where id = 900001),
  '("",t,t)', 'a removed comment loses its text and is marked removed');
select is((select status::text from public.reports where comment_id = 900001), 'resolved', 'removal closes the comment''s reports');
select ok(public.staff_comment_action(900001, 'restore', 'Removed by mistake'), 'staff restore a removed comment');
select is((select body from public.comments where id = 900001), 'A rude comment', 'the original text comes back from the log');

select is(public.staff_user_action('e0e00000-0000-0000-0000-000000000002', 'suspend', 'Spam', now() + interval '7 days') > now(),
  true, 'staff suspend a user');
select is((select status::text from public.reports where profile_id = 'e0e00000-0000-0000-0000-000000000002'), 'resolved',
  'suspending closes the profile''s reports');
select throws_ok($$select public.staff_user_action('e0e00000-0000-0000-0000-000000000002', 'suspend', 'x', now() - interval '1 day')$$,
  '22023', null, 'suspensions need a future end date');
select is(public.staff_user_action('e0e00000-0000-0000-0000-000000000002', 'ban', 'Repeat spam'), 'infinity'::timestamptz, 'staff ban a user');
select throws_ok($$select public.staff_user_action('e0e00000-0000-0000-0000-000000000005', 'ban', 'x')$$,
  '42501', null, 'moderators cannot act on other staff');
select throws_ok($$select public.set_user_role('e0e00000-0000-0000-0000-000000000001', 'moderator', 'x')$$,
  '42501', null, 'moderators cannot change roles');

-- ---------------------------------------------------------------------------
-- Admin
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"e0e00000-0000-0000-0000-000000000004","role":"authenticated"}';
select is(public.set_user_role('e0e00000-0000-0000-0000-000000000001', 'moderator', 'Trusted reader'),
  'moderator'::public.user_role, 'admins change roles (logged)');
select throws_ok($$select public.set_user_role('e0e00000-0000-0000-0000-000000000004', 'user', 'x')$$,
  '42501', null, 'admins cannot change their own role');

-- The log is append-only even for the owner.
reset role;
select throws_ok($$delete from public.moderation_actions$$, '42501', null, 'the log cannot be deleted');
select throws_ok($$update public.moderation_actions set reason = 'edited'$$, '42501', null, 'log entries cannot be edited');
select throws_ok($$update public.moderation_actions set article_id = 'e0e00000-0000-0000-0000-0000000000a2'$$,
  '42501', null, 'log references cannot be repointed');
delete from auth.users where id = 'e0e00000-0000-0000-0000-000000000002';
select is((select count(*)::int from public.moderation_actions where profile_id is null and action = 'ban_user'), 1,
  'deleting an account keeps its log entries, with the reference cleared');

select * from finish();
rollback;
