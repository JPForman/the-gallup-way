-- Step 4.1: the Latest feed.
--
-- feed_latest() returns published stories newest first, 20 at a time, with
-- keyset pagination on (published_at, id): pass the last row's published_at
-- and id to get the next page. SECURITY INVOKER, so RLS decides what each
-- caller sees (anon: published, not deleted). p_category is for 4.3.

-- Feed indexes include id so ties on published_at paginate stably.
drop index public.articles_feed_idx;
drop index public.articles_category_feed_idx;
create index articles_feed_idx on public.articles (published_at desc, id desc)
  where status = 'published' and deleted_at is null;
create index articles_category_feed_idx on public.articles (category, published_at desc, id desc)
  where status = 'published' and deleted_at is null;

create function public.feed_latest(
  p_before_published_at timestamptz default null,
  p_before_id uuid default null,
  p_limit integer default 20,
  p_category text default null
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
  image_alt text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    a.id, a.slug, a.title, a.dek,
    left(a.body_text, 300) as excerpt,
    a.category, a.content_type, a.published_at,
    p.handle, p.display_name,
    i.storage_path, i.alt_text
  from public.articles a
  left join public.profiles p on p.id = a.author_id
  left join public.article_images i on i.article_id = a.id and i.position = 0
  where a.status = 'published'
    and a.deleted_at is null
    and (p_category is null or a.category = p_category)
    and (
      p_before_published_at is null
      or (a.published_at, a.id) < (p_before_published_at, coalesce(p_before_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid))
    )
  order by a.published_at desc, a.id desc
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;

revoke execute on function public.feed_latest(timestamptz, uuid, integer, text) from public;
grant execute on function public.feed_latest(timestamptz, uuid, integer, text) to anon, authenticated, service_role;
