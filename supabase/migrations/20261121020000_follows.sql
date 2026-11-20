-- Step 5.3: follows and the Following feed.
--
-- Privacy (owner's choice): follower/following COUNTS are public, but who
-- follows whom is private. Users read only the rows where they are the
-- follower. Counts come from follow_context() (SECURITY DEFINER).
--
--   * Writers (can_write()) follow other people; unfollowing is always allowed.
--   * 100 new follows per user per day (spam guard).
--   * feed_following(): stories by people the caller follows, newest first,
--     keyset-paginated like feed_latest().

create table public.follows (
  follower_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  followee_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  constraint follows_not_self check (follower_id <> followee_id)
);

comment on table public.follows is 'Who follows whom. Private rows (follower only); public counts via follow_context().';

create index follows_followee_idx on public.follows (followee_id);

create function public.follows_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') then
    new.follower_id := (select auth.uid());
    new.created_at := now();
    if (select count(*) from public.follows f
        where f.follower_id = new.follower_id and f.created_at > now() - interval '24 hours') >= 100
    then
      raise exception 'You can follow up to 100 people a day. Try again tomorrow.'
        using errcode = 'PT429';
    end if;
  end if;
  return new;
end;
$$;

create trigger follows_before_insert
  before insert on public.follows
  for each row execute function public.follows_before_insert();

alter table public.follows enable row level security;
-- anon may select (no anon policy, so it sees no rows): lets feed_following()
-- simply return nothing for signed-out visitors.
grant select on public.follows to anon;
grant select, delete on public.follows to authenticated;
grant insert (followee_id) on public.follows to authenticated;

create policy "users see whom they follow"
  on public.follows for select
  to authenticated
  using (follower_id = (select auth.uid()));

create policy "writers follow other people"
  on public.follows for insert
  to authenticated
  with check (follower_id = (select auth.uid()) and public.can_write());

create policy "users unfollow"
  on public.follows for delete
  to authenticated
  using (follower_id = (select auth.uid()));

-- Counts for a profile, whether the caller follows them, and whether they may.
create function public.follow_context(p_profile_id uuid)
returns table (followers integer, following integer, is_following boolean, can_follow boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select count(*)::int from public.follows f where f.followee_id = p_profile_id),
    (select count(*)::int from public.follows f where f.follower_id = p_profile_id),
    exists (select 1 from public.follows f
            where f.follower_id = (select auth.uid()) and f.followee_id = p_profile_id),
    (select auth.uid()) is not null
      and (select auth.uid()) <> p_profile_id
      and public.can_write()
      and exists (select 1 from public.profiles p where p.id = p_profile_id);
$$;

revoke execute on function public.follow_context(uuid) from public;
grant execute on function public.follow_context(uuid) to anon, authenticated, service_role;

-- Stories by people the caller follows (empty for anon). Same columns as feed_latest().
create function public.feed_following(
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
  from public.follows f
  join public.articles a on a.author_id = f.followee_id
  left join public.profiles p on p.id = a.author_id
  left join public.article_images i on i.article_id = a.id and i.position = 0
  where f.follower_id = (select auth.uid())
    and a.status = 'published'
    and a.deleted_at is null
    and (
      p_before_published_at is null
      or (a.published_at, a.id) < (p_before_published_at, coalesce(p_before_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid))
    )
  order by a.published_at desc, a.id desc
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;

revoke execute on function public.feed_following(timestamptz, uuid, integer) from public;
grant execute on function public.feed_following(timestamptz, uuid, integer) to anon, authenticated, service_role;
