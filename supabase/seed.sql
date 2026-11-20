-- Local development seed data. Applied by `supabase db reset` after migrations.
-- Never pushed to the cloud project.
--
-- One sample writer (no password: can't sign in) with one published story,
-- used by local browsing and the e2e accessibility smoke test
-- (/a/farmers-market-moves-indoors-5eed01).

insert into auth.users (id, email, raw_user_meta_data) values
  ('5eed0000-0000-4000-8000-000000000001', 'sample-writer@example.invalid',
   '{"handle":"sample_writer","display_name":"Sample Writer","age_confirmed":true,"accepted_terms_version":2,"accepted_privacy_version":2}');

insert into public.articles (id, author_id, slug, title, dek, category, content_type, body_json, status, submitted_at, published_at) values
  ('5eed0000-0000-4000-8000-0000000000a1', '5eed0000-0000-4000-8000-000000000001',
   'farmers-market-moves-indoors-5eed01',
   'Farmers market moves indoors for the winter',
   'Vendors will set up at the community center on Saturdays through March.',
   'community', 'community',
   '{"type":"doc","content":[
     {"type":"paragraph","content":[{"type":"text","text":"The Saturday farmers market is moving indoors for the cold months. Vendors will set up from 9 a.m. to noon."}]},
     {"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"What to expect"}]},
     {"type":"bulletList","content":[
       {"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Winter squash, chile and roasted piñon"}]}]},
       {"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Baked goods and "},{"type":"text","marks":[{"type":"bold"}],"text":"hot coffee"}]}]}
     ]},
     {"type":"paragraph","content":[{"type":"text","text":"Details are on the "},{"type":"text","marks":[{"type":"link","attrs":{"href":"https://www.gallupnm.gov/"}}],"text":"city website"},{"type":"text","text":"."}]}
   ]}',
   'published', now() - interval '2 days', now() - interval '2 days');

insert into public.article_sources (article_id, position, url, label) values
  ('5eed0000-0000-4000-8000-0000000000a1', 0, 'https://www.gallupnm.gov/', 'City of Gallup');

insert into public.corrections (article_id, body, created_by) values
  ('5eed0000-0000-4000-8000-0000000000a1',
   'An earlier version said the market starts at 8 a.m. It starts at 9 a.m.',
   '5eed0000-0000-4000-8000-000000000001');
