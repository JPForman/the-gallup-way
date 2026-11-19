-- Step 5.1: likes (reactions).
--
--   * reactions: one row per (story, user, kind). Only 'like' is allowed in v1;
--     'dislike' exists in the enum so it can be enabled later without a type change.
--   * Who liked what is private: users can read only their own rows. Counts
--     are public through like_count() / article_engagement() (SECURITY DEFINER).
--   * Writers (can_write()) like published stories that aren't their own.
--     Removing your own like is always allowed (it only deletes your data).
--   * Counts are computed from rows, never stored.

create type public.reaction_kind as enum ('like', 'dislike');

create table public.reactions (
  article_id uuid not null references public.articles (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  kind public.reaction_kind not null default 'like' check (kind = 'like'),
  created_at timestamptz not null default now(),
  primary key (article_id, user_id, kind)
);

comment on table public.reactions is 'Likes. Private rows; public counts via like_count()/article_engagement().';

create index reactions_user_idx on public.reactions (user_id, created_at desc);

-- Clients can't forge the user or the date.
create function public.reactions_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') then
    new.user_id := (select auth.uid());
    new.created_at := now();
  end if;
  return new;
end;
$$;

create trigger reactions_before_insert
  before insert on public.reactions
  for each row execute function public.reactions_before_insert();

alter table public.reactions enable row level security;
grant select, delete on public.reactions to authenticated;
grant insert (article_id, kind) on public.reactions to authenticated;

create policy "users see their own reactions"
  on public.reactions for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "writers like published stories by others"
  on public.reactions for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and public.can_write()
    and exists (
      select 1 from public.articles a
      where a.id = article_id
        and a.status = 'published'
        and a.deleted_at is null
        and a.author_id is distinct from (select auth.uid())
    )
  );

create policy "users remove their own reactions"
  on public.reactions for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- Like count of a story everyone can see (0 otherwise).
create function public.like_count(p_article_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int
  from public.reactions r
  join public.articles a on a.id = r.article_id
  where r.article_id = p_article_id
    and r.kind = 'like'
    and a.status = 'published'
    and a.deleted_at is null;
$$;

-- For the like button: count, whether the caller liked it, and whether they may.
create function public.article_engagement(p_article_id uuid)
returns table (like_count integer, liked boolean, can_like boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select
    public.like_count(p_article_id),
    exists (
      select 1 from public.reactions r
      where r.article_id = p_article_id and r.user_id = (select auth.uid()) and r.kind = 'like'
    ),
    (select auth.uid()) is not null
      and public.can_write()
      and exists (
        select 1 from public.articles a
        where a.id = p_article_id and a.status = 'published' and a.deleted_at is null
          and a.author_id is distinct from (select auth.uid())
      );
$$;

revoke execute on function public.like_count(uuid), public.article_engagement(uuid) from public;
grant execute on function public.like_count(uuid), public.article_engagement(uuid) to anon, authenticated, service_role;

-- Top Stories now counts likes (comments arrive in 5.2).
create or replace function public.top_stories(p_limit integer default 20)
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
      public.like_count(r.id) as likes,
      -- 5.2: comments.
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
