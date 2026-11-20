-- Admin dashboard read functions (migration 20261123010000).
begin;
select plan(11);

delete from public.articles;
delete from public.reports;

insert into auth.users (id, email, raw_user_meta_data) values
  ('f0f00000-0000-0000-0000-000000000001', 'qr1@test.local',
   '{"handle":"qreader1","display_name":"Reader One","age_confirmed":true,"accepted_terms_version":2,"accepted_privacy_version":2}'),
  ('f0f00000-0000-0000-0000-000000000002', 'qr2@test.local',
   '{"handle":"qreader2","display_name":"Reader Two","age_confirmed":true,"accepted_terms_version":2,"accepted_privacy_version":2}'),
  ('f0f00000-0000-0000-0000-000000000003', 'qa@test.local',
   '{"handle":"qauthor","display_name":"Queue Author","age_confirmed":true,"accepted_terms_version":2,"accepted_privacy_version":2}'),
  ('f0f00000-0000-0000-0000-000000000004', 'qm@test.local',
   '{"handle":"qmod","display_name":"Queue Mod","age_confirmed":true,"accepted_terms_version":2,"accepted_privacy_version":2}');
update public.profiles set role = 'moderator' where handle = 'qmod';

insert into public.articles (id, author_id, slug, title, category, body_json, status, submitted_at, published_at) values
  ('f0f00000-0000-0000-0000-0000000000a1', 'f0f00000-0000-0000-0000-000000000003', 'q-pub', 'Queue published story', 'news',
   '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"x"}]}]}', 'published', now(), now());
insert into public.articles (id, author_id, slug, title, category, body_json, status, submitted_at) values
  ('f0f00000-0000-0000-0000-0000000000a2', 'f0f00000-0000-0000-0000-000000000003', 'q-pend', 'Queue pending story', 'news',
   '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"x"}]}]}', 'pending_review', now());
insert into public.comments (id, article_id, author_id, body) overriding system value values
  (910001, 'f0f00000-0000-0000-0000-0000000000a1', 'f0f00000-0000-0000-0000-000000000003', 'Reported comment text');

-- Two spam reports on the comment (older), two reports on the story (one high).
insert into public.reports (reporter_id, target_type, comment_id, reason, created_at) values
  ('f0f00000-0000-0000-0000-000000000001', 'comment', 910001, 'spam', now() - interval '2 hours'),
  ('f0f00000-0000-0000-0000-000000000002', 'comment', 910001, 'spam', now() - interval '1 hour');
insert into public.reports (reporter_id, target_type, article_id, reason, details, created_at) values
  ('f0f00000-0000-0000-0000-000000000001', 'article', 'f0f00000-0000-0000-0000-0000000000a1', 'harassment', null, now() - interval '30 minutes'),
  ('f0f00000-0000-0000-0000-000000000002', 'article', 'f0f00000-0000-0000-0000-0000000000a1', 'defamation', 'Names a neighbor', now() - interval '10 minutes');

set local role authenticated;
set local request.jwt.claims to '{"sub":"f0f00000-0000-0000-0000-000000000001","role":"authenticated"}';
select throws_ok($$select * from public.admin_stats()$$, '42501', null, 'non-staff cannot read stats');
select throws_ok($$select * from public.admin_report_queue()$$, '42501', null, 'non-staff cannot read the queue');
select throws_ok($$select * from public.admin_new_users()$$, '42501', null, 'non-staff cannot list users');

set local request.jwt.claims to '{"sub":"f0f00000-0000-0000-0000-000000000004","role":"authenticated"}';
select is((select row(open_reports, high_priority_reports, pending_stories)::text from public.admin_stats()), '(4,1,1)',
  'stats count open reports, high priority ones, and pending stories');
select ok((select new_users_7d >= 4 from public.admin_stats()), 'stats count new users');
select is((select array_agg(target_type::text) from public.admin_report_queue()), '{article,comment}'::text[],
  'reports are grouped by item, high priority first');
select is((select row(report_count, high, summary, slug, handle, item_state)::text from public.admin_report_queue() where target_type = 'article'),
  '(2,t,"Queue published story",q-pub,qauthor,published)', 'the story group has a count, summary and links');
select is((select reasons from public.admin_report_queue() where target_type = 'article'), '{defamation,harassment}'::text[],
  'reasons are listed once each');
select is((select details from public.admin_report_queue() where target_type = 'article'), '{"Names a neighbor"}'::text[],
  'details are collected');
select is((select row(report_count, summary, slug, item_state)::text from public.admin_report_queue() where target_type = 'comment'),
  '(2,"Reported comment text",q-pub,visible)', 'the comment group links to its story');
select is((select open_reports from public.admin_new_users() where handle = 'qauthor'), 4,
  'new users show open reports against their content');

select * from finish();
rollback;
