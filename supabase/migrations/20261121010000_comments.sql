-- Step 5.2: comments with one level of replies.
--
--   * Plain text, 1–2000 characters. Replies point at a top-level comment on
--     the same story (no deeper nesting).
--   * Public read when the story is visible. Writers (can_write()) comment on
--     published stories unless comments are locked. 60 comments/day/user.
--   * Authors delete their own comments with delete_comment(): the text is
--     erased and deleted_at set, so replies keep their place ("Comment deleted").
--     Staff removal comes with Phase 6 (and writes moderation_actions).
--   * comment_count() feeds Top Stories.

create table public.comments (
  id bigint generated always as identity primary key,
  article_id uuid not null references public.articles (id) on delete cascade,
  -- Null after account deletion.
  author_id uuid default auth.uid() references public.profiles (id) on delete set null,
  parent_id bigint references public.comments (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint comments_body_check check (
    (deleted_at is null and char_length(btrim(body)) between 1 and 2000)
    or (deleted_at is not null and body = '')
  )
);

comment on table public.comments is 'Story comments; one level of replies. Deleted comments keep their row with empty text.';

create index comments_article_idx on public.comments (article_id, created_at, id) where parent_id is null;
create index comments_parent_idx on public.comments (parent_id, created_at) where parent_id is not null;
create index comments_author_idx on public.comments (author_id, created_at);

create function public.comments_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  parent public.comments%rowtype;
begin
  if current_user in ('anon', 'authenticated') then
    new.author_id := (select auth.uid());
    new.created_at := now();
    new.deleted_at := null;

    if (select count(*) from public.comments c
        where c.author_id = new.author_id and c.created_at > now() - interval '24 hours') >= 60
    then
      raise exception 'You can post up to 60 comments a day. Try again tomorrow.'
        using errcode = 'PT429';
    end if;
  end if;

  if new.parent_id is not null then
    select * into parent from public.comments where id = new.parent_id;
    if not found or parent.article_id <> new.article_id then
      raise exception 'You can only reply to a comment on the same story' using errcode = '23514';
    end if;
    if parent.parent_id is not null then
      raise exception 'Replies can''t be nested' using errcode = '23514';
    end if;
    if parent.deleted_at is not null then
      raise exception 'You can''t reply to a deleted comment' using errcode = '23514';
    end if;
  end if;

  new.body := btrim(new.body);
  return new;
end;
$$;

create trigger comments_before_insert
  before insert on public.comments
  for each row execute function public.comments_before_insert();

alter table public.comments enable row level security;
grant select on public.comments to anon, authenticated;
grant insert (article_id, parent_id, body) on public.comments to authenticated;

create policy "comments follow article visibility"
  on public.comments for select
  to anon, authenticated
  using (public.can_view_article(article_id));

create policy "writers comment on open published stories"
  on public.comments for insert
  to authenticated
  with check (
    author_id = (select auth.uid())
    and public.can_write()
    and exists (
      select 1 from public.articles a
      where a.id = article_id
        and a.status = 'published'
        and a.deleted_at is null
        and not a.comments_locked
    )
  );

-- Delete your own comment (allowed even while suspended: it only removes your words).
create function public.delete_comment(p_comment_id bigint)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.comments
    set body = '', deleted_at = now()
  where id = p_comment_id
    and author_id = (select auth.uid())
    and deleted_at is null;
  return found;
end;
$$;

revoke execute on function public.delete_comment(bigint) from public, anon;
grant execute on function public.delete_comment(bigint) to authenticated, service_role;

-- Comments shown on a story everyone can see (0 otherwise; deleted ones don't count).
create function public.comment_count(p_article_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int
  from public.comments c
  join public.articles a on a.id = c.article_id
  where c.article_id = p_article_id
    and c.deleted_at is null
    and a.status = 'published'
    and a.deleted_at is null;
$$;

-- For the comments section: count, whether comments are closed, and whether
-- the caller may comment.
create function public.comments_context(p_article_id uuid)
returns table (comment_count integer, locked boolean, can_comment boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select
    public.comment_count(p_article_id),
    coalesce((select a.comments_locked from public.articles a where a.id = p_article_id), false),
    (select auth.uid()) is not null
      and public.can_write()
      and exists (
        select 1 from public.articles a
        where a.id = p_article_id and a.status = 'published' and a.deleted_at is null and not a.comments_locked
      );
$$;

revoke execute on function public.comment_count(uuid), public.comments_context(uuid) from public;
grant execute on function public.comment_count(uuid), public.comments_context(uuid) to anon, authenticated, service_role;

-- Top Stories now counts comments too.
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
      public.comment_count(r.id) as comments,
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
