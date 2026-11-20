-- Step 5.4: bookmarks ("Saved").
--
--   * Private: users read, add and remove only their own bookmarks. Nobody
--     else (not even counts) sees them.
--   * Any signed-in user may bookmark, even while suspended or unverified:
--     it's their own private reading list, not public writing.
--   * Only published, visible stories can be saved; stories that are later
--     hidden or deleted simply drop out of saved_articles().
--   * 500 new bookmarks per user per day (abuse guard).

create table public.bookmarks (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  article_id uuid not null references public.articles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, article_id)
);

comment on table public.bookmarks is 'Saved stories. Private to the user.';

create index bookmarks_user_created_idx on public.bookmarks (user_id, created_at desc, article_id desc);

create function public.bookmarks_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') then
    new.user_id := (select auth.uid());
    new.created_at := now();
    if (select count(*) from public.bookmarks b
        where b.user_id = new.user_id and b.created_at > now() - interval '24 hours') >= 500
    then
      raise exception 'You can save up to 500 stories a day. Try again tomorrow.'
        using errcode = 'PT429';
    end if;
  end if;
  return new;
end;
$$;

create trigger bookmarks_before_insert
  before insert on public.bookmarks
  for each row execute function public.bookmarks_before_insert();

alter table public.bookmarks enable row level security;
grant select, delete on public.bookmarks to authenticated;
grant insert (article_id) on public.bookmarks to authenticated;

create policy "users see their own bookmarks"
  on public.bookmarks for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "users save published stories"
  on public.bookmarks for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.articles a
      where a.id = article_id and a.status = 'published' and a.deleted_at is null
    )
  );

create policy "users remove their own bookmarks"
  on public.bookmarks for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- The caller's saved stories, most recently saved first, keyset-paginated on
-- (saved_at, id). Same columns as feed_latest() plus saved_at.
create function public.saved_articles(
  p_before_saved_at timestamptz default null,
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
  image_alt text,
  saved_at timestamptz
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
    i.storage_path, i.alt_text,
    b.created_at as saved_at
  from public.bookmarks b
  join public.articles a on a.id = b.article_id
  left join public.profiles p on p.id = a.author_id
  left join public.article_images i on i.article_id = a.id and i.position = 0
  where b.user_id = (select auth.uid())
    and a.status = 'published'
    and a.deleted_at is null
    and (
      p_before_saved_at is null
      or (b.created_at, a.id) < (p_before_saved_at, coalesce(p_before_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid))
    )
  order by b.created_at desc, a.id desc
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;

revoke execute on function public.saved_articles(timestamptz, uuid, integer) from public, anon;
grant execute on function public.saved_articles(timestamptz, uuid, integer) to authenticated, service_role;
