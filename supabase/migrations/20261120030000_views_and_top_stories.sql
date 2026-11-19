-- Step 4.2: daily view counts and Top Stories.
--
--   * article_views: ONE row per article per day (never a row per view).
--     Written only by record_view(); readable when the article is.
--   * ranking_score(): the Top Stories formula, mirrored in src/lib/ranking.ts
--     (both are tested against the same numbers).
--   * top_stories(): published stories from the last 7 days, best score first.
--     Likes and comments arrive in Phase 5; until then they count as 0.

create table public.article_views (
  article_id uuid not null references public.articles (id) on delete cascade,
  day date not null default (now() at time zone 'America/Denver')::date,
  views integer not null default 0 check (views >= 0),
  primary key (article_id, day)
);

comment on table public.article_views is 'Daily view totals per article (Gallup local day). Written by record_view() only.';

create index article_views_day_idx on public.article_views (day);

alter table public.article_views enable row level security;
grant select on public.article_views to anon, authenticated;

create policy "views follow article visibility"
  on public.article_views for select
  to anon, authenticated
  using (public.can_view_article(article_id));

-- Count one view of a published story. The author's own views don't count.
-- Returns true when a view was counted. The page calls this from the browser
-- (once per story per day per visitor; see src/components/article/view-counter.tsx).
create function public.record_view(p_article_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.articles a
    where a.id = p_article_id
      and a.status = 'published'
      and a.deleted_at is null
      and a.author_id is distinct from (select auth.uid())
  ) then
    return false;
  end if;

  insert into public.article_views as v (article_id, day, views)
  values (p_article_id, (now() at time zone 'America/Denver')::date, 1)
  on conflict (article_id, day) do update set views = v.views + 1;
  return true;
end;
$$;

revoke execute on function public.record_view(uuid) from public;
grant execute on function public.record_view(uuid) to anon, authenticated, service_role;

-- score = (likes + 2*comments + views/25) / (hours_since_publish + 2)^1.5
create function public.ranking_score(p_likes integer, p_comments integer, p_views integer, p_hours double precision)
returns double precision
language sql
immutable
set search_path = ''
as $$
  select (coalesce(p_likes, 0) + 2.0 * coalesce(p_comments, 0) + coalesce(p_views, 0) / 25.0)
       / power(greatest(coalesce(p_hours, 0), 0) + 2.0, 1.5);
$$;

grant execute on function public.ranking_score(integer, integer, integer, double precision)
  to anon, authenticated, service_role;

-- Same columns as feed_latest() plus the score. SECURITY INVOKER: RLS applies.
create function public.top_stories(p_limit integer default 20)
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
  score double precision
)
language sql
stable
security invoker
set search_path = ''
as $$
  with recent as (
    select a.*
    from public.articles a
    where a.status = 'published'
      and a.deleted_at is null
      and a.published_at > now() - interval '7 days'
  ),
  stats as (
    select r.id,
      -- Phase 5: likes from reactions, comments from comments.
      0 as likes,
      0 as comments,
      coalesce((select sum(v.views)::int from public.article_views v where v.article_id = r.id), 0) as views
    from recent r
  )
  select
    r.id, r.slug, r.title, r.dek,
    left(r.body_text, 300) as excerpt,
    r.category, r.content_type, r.published_at,
    p.handle, p.display_name,
    i.storage_path, i.alt_text,
    public.ranking_score(s.likes, s.comments, s.views,
      extract(epoch from (now() - r.published_at)) / 3600.0) as score
  from recent r
  join stats s on s.id = r.id
  left join public.profiles p on p.id = r.author_id
  left join public.article_images i on i.article_id = r.id and i.position = 0
  order by score desc, r.published_at desc, r.id desc
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;

revoke execute on function public.top_stories(integer) from public;
grant execute on function public.top_stories(integer) to anon, authenticated, service_role;
