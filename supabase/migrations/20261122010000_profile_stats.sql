-- Step 5.5: contributor stats and a writer's stories on their profile.
--
--   * profile_stats(): published stories, likes and comments they received,
--     and total reads. Public numbers only (published, non-deleted stories;
--     deleted comments don't count). Nothing private: no bookmarks, no
--     who-follows-whom.
--   * feed_author(): a writer's published stories, newest first, keyset-
--     paginated like feed_latest().

create index articles_author_feed_idx on public.articles (author_id, published_at desc, id desc)
  where status = 'published' and deleted_at is null;

create function public.profile_stats(p_profile_id uuid)
returns table (stories integer, likes integer, comments integer, views integer)
language sql
stable
security definer
set search_path = ''
as $$
  with mine as (
    select a.id from public.articles a
    where a.author_id = p_profile_id and a.status = 'published' and a.deleted_at is null
  )
  select
    (select count(*)::int from mine),
    (select count(*)::int from public.reactions r where r.kind = 'like' and r.article_id in (select id from mine)),
    (select count(*)::int from public.comments c where c.deleted_at is null and c.article_id in (select id from mine)),
    (select coalesce(sum(v.views), 0)::int from public.article_views v where v.article_id in (select id from mine));
$$;

revoke execute on function public.profile_stats(uuid) from public;
grant execute on function public.profile_stats(uuid) to anon, authenticated, service_role;

create function public.feed_author(
  p_author_id uuid,
  p_before_published_at timestamptz default null,
  p_before_id uuid default null,
  p_limit integer default 20
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
  where a.author_id = p_author_id
    and a.status = 'published'
    and a.deleted_at is null
    and (
      p_before_published_at is null
      or (a.published_at, a.id) < (p_before_published_at, coalesce(p_before_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid))
    )
  order by a.published_at desc, a.id desc
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;

revoke execute on function public.feed_author(uuid, timestamptz, uuid, integer) from public;
grant execute on function public.feed_author(uuid, timestamptz, uuid, integer) to anon, authenticated, service_role;
