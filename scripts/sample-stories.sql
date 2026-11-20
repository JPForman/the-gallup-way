-- Sample stories for looking around LOCALLY (run: pnpm db:samples).
-- Fictional content; never run this against the cloud project.
-- Re-runnable: removes previous samples first. `pnpm db:reset` also clears them.

-- Remove earlier samples (articles first: author_id is "on delete set null").
delete from public.articles where author_id in (
  '5a5a0000-0000-4000-8000-000000000001', '5a5a0000-0000-4000-8000-000000000002', '5a5a0000-0000-4000-8000-000000000003');
delete from auth.users where id in (
  '5a5a0000-0000-4000-8000-000000000001', '5a5a0000-0000-4000-8000-000000000002', '5a5a0000-0000-4000-8000-000000000003');

-- Three writers without passwords (they can't sign in).
insert into auth.users (id, email, raw_user_meta_data) values
  ('5a5a0000-0000-4000-8000-000000000001', 'rosa.sample@example.invalid',
   '{"handle":"rosa_sample","display_name":"Rosa Yazzie","age_confirmed":true,"accepted_terms_version":1,"accepted_privacy_version":1}'),
  ('5a5a0000-0000-4000-8000-000000000002', 'dan.sample@example.invalid',
   '{"handle":"dan_sample","display_name":"Dan Morales","age_confirmed":true,"accepted_terms_version":1,"accepted_privacy_version":1}'),
  ('5a5a0000-0000-4000-8000-000000000003', 'lena.sample@example.invalid',
   '{"handle":"lena_sample","display_name":"Lena Chee","age_confirmed":true,"accepted_terms_version":1,"accepted_privacy_version":1}');
update public.profiles set bio = 'Retired teacher. Writes about schools, gardens and the people who keep them going.'
  where id = '5a5a0000-0000-4000-8000-000000000001';
update public.profiles set bio = 'Coaches youth soccer on weekends. Covers sports and the occasional potluck.'
  where id = '5a5a0000-0000-4000-8000-000000000002';

-- Paragraphs -> Tiptap doc.
create function pg_temp.doc(variadic paras text[]) returns jsonb language sql as $$
  select jsonb_build_object('type', 'doc', 'content', jsonb_agg(
    jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', p)))))
  from unnest(paras) p;
$$;

create temp table samples (n int, author int, title text, dek text, category text, ctype public.content_type,
  hours_ago int, views int, body jsonb);

insert into samples values
  (1, 1, 'Library adds Saturday story hour for toddlers', 'Volunteers will read in English and Navajo, starting next month.',
   'community', 'community', 3, 900, pg_temp.doc(
     'The children''s room will host a 30-minute story hour every Saturday at 10 a.m. Volunteers will read picture books in English and Navajo, with songs at the end.',
     'Parents can drop in; there''s no sign-up. The room fits about 20 families, so arriving a few minutes early is a good idea.',
     'The library is also looking for more volunteer readers. Anyone interested can ask at the front desk.')),
  (2, 2, 'Under-12 soccer team wins regional tournament', 'A last-minute goal sealed a 2–1 final.',
   'sports', 'sports', 7, 1600, pg_temp.doc(
     'The under-12 team came home with the regional trophy on Sunday after a 2–1 win in the final.',
     'Down 1–0 at halftime, the team tied it early in the second half and scored the winner with less than a minute left.',
     'The players thanked the parents who drove them across the state and the local businesses that paid for new jerseys.')),
  (3, 3, 'Snow plows ready as first winter storm nears', 'Crews will start on main roads, then school routes.',
   'news', 'news', 12, 700, pg_temp.doc(
     'Forecasters expect three to six inches of snow by Thursday morning. Road crews say the plows and salt trucks are ready.',
     'Main roads come first, followed by school bus routes and then neighborhood streets.',
     'Residents are asked to park off the street where they can so plows can get through.')),
  (4, 1, 'Community garden opens winter plots in new greenhouse', null,
   'community', 'community', 20, 300, pg_temp.doc(
     'The community garden finished its small greenhouse this week, and 12 winter plots are available.',
     'Plots are free for the season. Gardeners are asked to help water on a shared schedule.',
     'Lettuce, spinach and herbs do best in the cold months, the organizers say.')),
  (5, 2, 'In my view: our town needs more crosswalks near schools', 'Drivers and kids share the same streets every morning. We can make that safer.',
   'opinion', 'opinion', 26, 1100, pg_temp.doc(
     'Every school morning I watch kids cross busy streets without a marked crosswalk. Most drivers slow down. Some don''t.',
     'Painted crosswalks and a few flashing signs cost far less than a single serious accident.',
     'I''d like to see parents, teachers and neighbors ask for a walking survey of every school route before next fall.')),
  (6, 3, 'Holiday craft fair set for the first weekend of December', 'More than 40 local makers have signed up.',
   'events', 'event', 30, 500, pg_temp.doc(
     'The holiday craft fair returns the first Saturday and Sunday of December, from 9 a.m. to 4 p.m. both days.',
     'Booths will sell jewelry, pottery, knitted goods, baked treats and art. Entry is free.',
     'Organizers suggest bringing cash, since not every booth takes cards.')),
  (7, 1, 'High school robotics club heads to state competition', null,
   'education', 'news', 40, 400, pg_temp.doc(
     'The robotics club qualified for the state competition after placing second at the district round.',
     'This year''s robot sorts and stacks blocks. The students built it over eight weeks, mostly after school.',
     'The club is raising money for travel with a bake sale on Friday.')),
  (8, 2, 'New bakery opens on the east side', 'Green chile bread sold out on the first morning.',
   'business', 'business', 50, 800, pg_temp.doc(
     'A new family-run bakery opened this week on the east side of town.',
     'The owners say the green chile cheese bread sold out by 10 a.m. on opening day, so they''re doubling the batch.',
     'The bakery is open Tuesday through Saturday, 6 a.m. to 2 p.m.')),
  (9, 3, 'Volunteers clean up two miles of trail', null,
   'community', 'community', 60, 200, pg_temp.doc(
     'About 30 volunteers spent Saturday morning picking up trash along two miles of hiking trail.',
     'They filled 45 bags and found an old shopping cart, two tires and a lawn chair.',
     'The group plans another cleanup in the spring.')),
  (10, 1, 'How the county budget process works, step by step', 'A plain-language guide to when and how residents can weigh in.',
   'government', 'news', 72, 600, pg_temp.doc(
     'Each spring, county departments submit budget requests. Commissioners review them in public meetings over several weeks.',
     'Residents can speak during the public comment part of each meeting, usually limited to three minutes per person.',
     'Agendas are posted a few days before each meeting.')),
  (11, 2, 'Basketball season tips off with a home win', null,
   'sports', 'sports', 80, 350, pg_temp.doc(
     'The varsity team opened the season with a 58–51 home win on Friday night.',
     'The gym was close to full, and the student section stayed loud through all four quarters.')),
  (12, 3, 'Food bank needs volunteers for holiday rush', 'Shifts are two hours; no experience needed.',
   'community', 'community', 96, 450, pg_temp.doc(
     'The food bank expects twice as many families as usual in December and is asking for volunteers.',
     'Shifts are two hours long, on weekday afternoons and Saturday mornings.',
     'Volunteers sort donations, pack boxes and help families carry groceries to their cars.')),
  (13, 1, 'Elementary school celebrates reading milestone', null,
   'education', 'community', 110, 150, pg_temp.doc(
     'Students at the elementary school have read 10,000 books since August, beating their goal for the whole year.',
     'The principal promised to read to every class from the school roof if they reached the goal. That''s happening Friday.')),
  (14, 2, 'Farmers market moves indoors for winter', 'Vendors will set up at the community center on Saturdays through March.',
   'business', 'business', 130, 300, pg_temp.doc(
     'The Saturday farmers market is moving indoors for the cold months. Vendors will set up from 9 a.m. to noon.',
     'Expect winter squash, chile, roasted piñon, baked goods and hot coffee.')),
  (15, 3, 'Letter: thank you to the neighbors who found my dog', null,
   'opinion', 'opinion', 150, 120, pg_temp.doc(
     'Last week my dog slipped out of the yard during the wind storm. Three neighbors I had never met spent an evening helping me look.',
     'She was found two streets over, cold but fine. I want to say thank you publicly. This is the kind of town I''m proud to live in.'));

-- Older stories (8–20 days ago) so Latest has a second page and Top's
-- 7-day window leaves some out.
insert into samples
select 15 + g, 1 + (g % 3),
  (array['Church choir plans winter concert', 'Senior center starts chair yoga class', 'Rodeo grounds get new bleachers',
         'Middle school science fair winners announced', 'Hardware store marks 40 years in business', 'Youth wrestling club opens registration',
         'Recycling drop-off adds glass collection', 'Art walk returns downtown', 'Quilt guild donates blankets to shelter',
         'Bus route adds evening stop'])[g],
  null,
  (array['community', 'community', 'sports', 'education', 'business', 'sports', 'news', 'events', 'community', 'news'])[g],
  (array['community', 'community', 'sports', 'news', 'business', 'sports', 'news', 'event', 'community', 'news'])[g]::public.content_type,
  (8 * 24) + g * 30, 50 * g,
  pg_temp.doc('A short sample story for checking the layout. It has a single paragraph so the feed shows an excerpt.',
              'A second paragraph adds a little more text.')
from generate_series(1, 10) g;

insert into public.articles (id, author_id, slug, title, dek, category, content_type, body_json, status, submitted_at, published_at)
select
  ('5a5a0000-0000-4000-8000-0000000001' || lpad(n::text, 2, '0'))::uuid,
  ('5a5a0000-0000-4000-8000-00000000000' || author)::uuid,
  slugify(title) || '-5a5a' || lpad(n::text, 2, '0'),
  title, dek, category, ctype, body, 'published',
  now() - make_interval(hours => hours_ago), now() - make_interval(hours => hours_ago)
from samples;

-- Daily view totals (spread over the story's life) for Top Stories.
insert into public.article_views (article_id, day, views)
select ('5a5a0000-0000-4000-8000-0000000001' || lpad(n::text, 2, '0'))::uuid,
  ((now() - make_interval(hours => hours_ago)) at time zone 'America/Denver')::date, views
from samples where views > 0;

-- Sources on a few stories.
insert into public.article_sources (article_id, position, url, label) values
  ('5a5a0000-0000-4000-8000-000000000103', 0, 'https://www.weather.gov/', 'National Weather Service'),
  ('5a5a0000-0000-4000-8000-000000000110', 0, 'https://www.example.org/county-budget', 'County budget calendar (example)'),
  ('5a5a0000-0000-4000-8000-000000000110', 1, 'https://www.example.org/agendas', 'Meeting agendas (example)');

-- A later edit (shows "Updated") and a correction.
update public.articles
  set body_json = pg_temp.doc(
    'The under-12 team came home with the regional trophy on Sunday after a 2–1 win in the final.',
    'Down 1–0 at halftime, the team tied it early in the second half and scored the winner with less than a minute left.',
    'The players thanked the parents who drove them across the state and the local businesses that paid for new jerseys.',
    'Update: the team will be honored at Friday''s home basketball game.'),
      edited_at = now() - interval '2 hours'
  where id = '5a5a0000-0000-4000-8000-000000000102';
insert into public.corrections (article_id, body, created_by, created_at) values
  ('5a5a0000-0000-4000-8000-000000000106',
   'An earlier version said the fair runs until 5 p.m. It closes at 4 p.m. both days.',
   '5a5a0000-0000-4000-8000-000000000003', now() - interval '20 hours');

-- A few likes between the sample writers (nobody likes their own story).
insert into public.reactions (article_id, user_id)
select a.id, u.id
from public.articles a
cross join (values ('5a5a0000-0000-4000-8000-000000000001'::uuid), ('5a5a0000-0000-4000-8000-000000000002'::uuid),
                   ('5a5a0000-0000-4000-8000-000000000003'::uuid)) u(id)
where a.id::text like '5a5a0000-0000-4000-8000-0000000001%'
  and a.author_id <> u.id
  and right(a.id::text, 2)::int in (1, 2, 5, 6, 8, 12);

-- A short conversation on the crosswalk opinion piece, and a comment on the soccer story.
insert into public.comments (article_id, author_id, body, created_at) values
  ('5a5a0000-0000-4000-8000-000000000105', '5a5a0000-0000-4000-8000-000000000001',
   'Agreed. The corner by the elementary school is the worst at drop-off time.', now() - interval '20 hours'),
  ('5a5a0000-0000-4000-8000-000000000105', '5a5a0000-0000-4000-8000-000000000003',
   'A walking survey is a great idea. Count me in if you organize one.', now() - interval '18 hours'),
  ('5a5a0000-0000-4000-8000-000000000102', '5a5a0000-0000-4000-8000-000000000001',
   'Congratulations to the team and the coaches!', now() - interval '5 hours');
insert into public.comments (article_id, author_id, parent_id, body, created_at)
select '5a5a0000-0000-4000-8000-000000000105', '5a5a0000-0000-4000-8000-000000000002', c.id,
  'Thanks, Rosa. I''ll ask the school about a date in the spring.', now() - interval '19 hours'
from public.comments c
where c.article_id = '5a5a0000-0000-4000-8000-000000000105' and c.author_id = '5a5a0000-0000-4000-8000-000000000001';

-- Sample follows: Rosa and Lena follow Dan; Dan follows Rosa.
insert into public.follows (follower_id, followee_id, created_at) values
  ('5a5a0000-0000-4000-8000-000000000001', '5a5a0000-0000-4000-8000-000000000002', now() - interval '3 days'),
  ('5a5a0000-0000-4000-8000-000000000003', '5a5a0000-0000-4000-8000-000000000002', now() - interval '2 days'),
  ('5a5a0000-0000-4000-8000-000000000002', '5a5a0000-0000-4000-8000-000000000001', now() - interval '1 day')
on conflict do nothing;

select count(*) as sample_stories from public.articles where id::text like '5a5a0000-0000-4000-8000-0000000001%';
