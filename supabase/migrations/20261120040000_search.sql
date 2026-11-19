-- Step 4.4: search stories and writers.
--
-- Both functions are SECURITY INVOKER, so RLS and column grants apply exactly
-- as for direct reads (anon: published stories, public profile columns).
-- The /search page is dynamic, so these are kept cheap: bounded query length,
-- page size and offset.

-- Stories: full-text over articles.search (title A, dek B, body C) using
-- web-search syntax ("quoted phrases", -exclude, or). Best match first, then newest.
create function public.search_articles(
  p_query text,
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  id uuid,
  slug text,
  title text,
  dek text,
  excerpt text,
  category text,
  content_type public.content_type,
  published_at timestamptz,
  author_handle text,
  author_display_name text,
  image_path text,
  image_alt text,
  rank real
)
language sql
stable
security invoker
set search_path = ''
as $$
  with q as (
    select websearch_to_tsquery('english', left(coalesce(p_query, ''), 100)) as tsq
  )
  select
    a.id, a.slug, a.title, a.dek,
    left(a.body_text, 300) as excerpt,
    a.category, a.content_type, a.published_at,
    p.handle, p.display_name,
    i.storage_path, i.alt_text,
    ts_rank(a.search, q.tsq) as rank
  from q
  join public.articles a on a.search @@ q.tsq
  left join public.profiles p on p.id = a.author_id
  left join public.article_images i on i.article_id = a.id and i.position = 0
  where numnode(q.tsq) > 0
    and a.status = 'published'
    and a.deleted_at is null
  order by rank desc, a.published_at desc, a.id desc
  limit least(greatest(coalesce(p_limit, 20), 1), 50)
  offset least(greatest(coalesce(p_offset, 0), 0), 500);
$$;

-- Writers: handle or display name contains the text (case-insensitive).
-- Exact handle first, then prefix matches, then the rest by name.
create function public.search_profiles(p_query text, p_limit integer default 20)
returns table (
  id uuid,
  handle text,
  display_name text,
  bio text,
  avatar_path text
)
language sql
stable
security invoker
set search_path = ''
as $$
  with t as (
    -- "@rosa" searches handles too: drop the leading @.
    select ltrim(lower(btrim(left(coalesce(p_query, ''), 100))), '@') as term
  ),
  q as (
    select term,
      -- Escape LIKE wildcards so "%" or "_" match literally.
      '%' || replace(replace(replace(term, '\', '\\'), '%', '\%'), '_', '\_') || '%' as pattern
    from t
  )
  select p.id, p.handle, p.display_name, left(p.bio, 200), p.avatar_path
  from q
  join public.profiles p
    on p.handle ilike q.pattern or p.display_name ilike q.pattern
  where q.term <> ''
  order by
    (p.handle = q.term) desc,
    (p.handle like q.term || '%' or lower(p.display_name) like q.term || '%') desc,
    lower(p.display_name), p.handle
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;

revoke execute on function public.search_articles(text, integer, integer), public.search_profiles(text, integer) from public;
grant execute on function public.search_articles(text, integer, integer), public.search_profiles(text, integer)
  to anon, authenticated, service_role;
