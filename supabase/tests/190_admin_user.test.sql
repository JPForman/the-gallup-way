-- Staff account view (migration 20261123020000).
begin;
select plan(4);

delete from public.articles;

insert into auth.users (id, email, raw_user_meta_data) values
  ('a1a10000-0000-0000-0000-000000000001', 'au1@test.local',
   '{"handle":"auwriter","display_name":"Account Writer","age_confirmed":true,"accepted_terms_version":1,"accepted_privacy_version":1}'),
  ('a1a10000-0000-0000-0000-000000000002', 'au2@test.local',
   '{"handle":"aumod","display_name":"Account Mod","age_confirmed":true,"accepted_terms_version":1,"accepted_privacy_version":1}');
update public.profiles set role = 'moderator' where handle = 'aumod';
update public.profiles set suspended_until = now() + interval '7 days' where handle = 'auwriter';

insert into public.articles (author_id, slug, title, category, body_json, status, submitted_at, published_at) values
  ('a1a10000-0000-0000-0000-000000000001', 'au-pub', 'Account published story', 'news',
   '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"x"}]}]}', 'published', now(), now());
insert into public.articles (author_id, slug, title, category, body_json, status, submitted_at) values
  ('a1a10000-0000-0000-0000-000000000001', 'au-hid', 'Account hidden story', 'news',
   '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"x"}]}]}', 'hidden', now());
insert into public.reports (reporter_id, target_type, profile_id, reason)
values ('a1a10000-0000-0000-0000-000000000002', 'profile', 'a1a10000-0000-0000-0000-000000000001', 'spam');

set local role authenticated;
set local request.jwt.claims to '{"sub":"a1a10000-0000-0000-0000-000000000001","role":"authenticated"}';
select throws_ok($$select * from public.admin_user('a1a10000-0000-0000-0000-000000000001')$$, '42501', null,
  'members cannot read the staff account view, even their own');

set local request.jwt.claims to '{"sub":"a1a10000-0000-0000-0000-000000000002","role":"authenticated"}';
select is((select row(handle, published, pending, hidden, open_reports)::text from public.admin_user('a1a10000-0000-0000-0000-000000000001')),
  '(auwriter,1,0,1,1)', 'staff see story counts by status and open reports');
select ok((select suspended_until > now() from public.admin_user('a1a10000-0000-0000-0000-000000000001')),
  'staff see the suspension');
select is((select count(*)::int from public.admin_user('a1a10000-0000-0000-0000-0000000000ff')), 0, 'unknown accounts return no row');

select * from finish();
rollback;
