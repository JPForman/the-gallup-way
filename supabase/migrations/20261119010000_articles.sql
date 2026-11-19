-- Step 3.1: categories, articles, sources, images, the submit/review rule
-- and the daily publishing limit.
--
-- Trust model (same as profiles):
--   * Clients write only the content columns (column grants). Owner, status,
--     slug, timestamps and moderation flags are set by triggers and
--     SECURITY DEFINER functions; the guard trigger rejects client changes.
--   * Status moves only through RPCs: submit_article(), withdraw_article()
--     (staff review / hide / restore arrive in Phase 6).
--   * body_text (search + previews) is derived from body_json in the DB, so it
--     always matches what is rendered.

create extension if not exists unaccent with schema extensions;

-- ---------------------------------------------------------------------------
-- Categories (fixed list; mirrored in src/lib/site.ts CATEGORIES, checked by
-- src/lib/site.test.ts)
-- ---------------------------------------------------------------------------
create table public.categories (
  slug text primary key check (slug ~ '^[a-z][a-z0-9-]{1,30}$'),
  name text not null check (char_length(name) between 1 and 40),
  sort smallint not null unique
);

alter table public.categories enable row level security;
revoke insert, update, delete, truncate on public.categories from anon, authenticated;

create policy "categories are readable by everyone"
  on public.categories for select
  to anon, authenticated
  using (true);

insert into public.categories (slug, name, sort) values
  ('news', 'News', 1),
  ('community', 'Community', 2),
  ('government', 'Government', 3),
  ('education', 'Education', 4),
  ('sports', 'Sports', 5),
  ('events', 'Events', 6),
  ('business', 'Business', 7),
  ('opinion', 'Opinion', 8);

-- ---------------------------------------------------------------------------
-- Types and text helpers
-- ---------------------------------------------------------------------------
create type public.content_type as enum ('news', 'community', 'opinion', 'event', 'sports', 'business');
create type public.article_status as enum ('draft', 'pending_review', 'published', 'hidden', 'archived');

-- "Café Día: Gallup!" -> "cafe-dia-gallup" (max 80 chars, may be empty).
create function public.slugify(t text)
returns text
language sql
stable
set search_path = ''
as $$
  select btrim(
    left(
      regexp_replace(
        lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(t, ''))),
        '[^a-z0-9]+', '-', 'g'),
      80),
    '-');
$$;

-- Plain text from a Tiptap JSON document: inline text nodes are joined as-is,
-- block nodes are separated by newlines. Mirrors src/lib/richtext (step 3.2).
create function public.richtext_plain(node jsonb)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  child jsonb;
  piece text;
  out text := '';
  inline boolean;
begin
  if jsonb_typeof(node) <> 'object' then
    return '';
  end if;
  if node ->> 'type' = 'text' then
    return coalesce(node ->> 'text', '');
  end if;
  if node ->> 'type' = 'hardBreak' then
    return E'\n';
  end if;
  if jsonb_typeof(node -> 'content') <> 'array' then
    return '';
  end if;

  inline := node ->> 'type' in ('paragraph', 'heading');
  for child in select value from jsonb_array_elements(node -> 'content') loop
    piece := public.richtext_plain(child);
    if inline then
      out := out || piece;
    elsif piece <> '' then
      out := case when out = '' then piece else out || E'\n' || piece end;
    end if;
  end loop;
  return out;
end;
$$;

-- ---------------------------------------------------------------------------
-- Articles
-- ---------------------------------------------------------------------------
create table public.articles (
  id uuid primary key default gen_random_uuid(),
  -- Null after account deletion with "keep my stories" ("Former member").
  author_id uuid references public.profiles (id) on delete set null,
  -- Set on first submission, then frozen.
  slug text unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 100),
  title text not null default '' check (char_length(title) <= 120),
  dek text check (char_length(dek) <= 240),
  body_json jsonb not null default '{"type":"doc","content":[]}'::jsonb
    check (body_json ->> 'type' = 'doc' and octet_length(body_json::text) <= 100000),
  body_text text not null default '',
  category text references public.categories (slug) on update cascade,
  content_type public.content_type not null default 'news',
  status public.article_status not null default 'draft',
  comments_locked boolean not null default false,
  submitted_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  search tsvector generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A')
    || setweight(to_tsvector('english', coalesce(dek, '')), 'B')
    || setweight(to_tsvector('english', body_text), 'C')
  ) stored,
  -- Anything past draft must be complete.
  constraint articles_complete_when_submitted check (
    status = 'draft'
    or (char_length(btrim(title)) >= 5
        and category is not null
        and char_length(btrim(body_text)) >= 1
        and slug is not null
        and submitted_at is not null)
  ),
  constraint articles_published_has_date check (status <> 'published' or published_at is not null)
);

comment on table public.articles is 'Community stories. Status changes go through submit_article()/withdraw_article() and staff functions.';

create index articles_feed_idx on public.articles (published_at desc)
  where status = 'published' and deleted_at is null;
create index articles_category_feed_idx on public.articles (category, published_at desc)
  where status = 'published' and deleted_at is null;
create index articles_author_idx on public.articles (author_id, created_at desc);
create index articles_author_submitted_idx on public.articles (author_id, submitted_at)
  where submitted_at is not null;
create index articles_pending_idx on public.articles (submitted_at)
  where status = 'pending_review' and deleted_at is null;
create index articles_search_idx on public.articles using gin (search);

-- Contributor Agreement acceptances belong to an article.
alter table public.agreement_acceptances
  add constraint agreement_acceptances_article_fk
  foreign key (article_id) references public.articles (id) on delete cascade;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
-- The caller may edit this article's content (and its images/sources).
create function public.can_edit_article(p_article_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.can_write() and exists (
    select 1 from public.articles a
    where a.id = p_article_id
      and a.author_id = (select auth.uid())
      and a.deleted_at is null
      and a.status in ('draft', 'pending_review', 'published')
  );
$$;

-- The caller may see this article (used by child-table policies).
create function public.can_view_article(p_article_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.articles a
    where a.id = p_article_id
      and (
        (a.status = 'published' and a.deleted_at is null)
        or (a.author_id = (select auth.uid()) and a.deleted_at is null)
        or public.is_staff()
      )
  );
$$;

revoke execute on function public.can_edit_article(uuid), public.can_view_article(uuid) from public;
grant execute on function public.can_edit_article(uuid), public.can_view_article(uuid)
  to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Write trigger: defaults on insert, guard on update, derived body_text.
-- ---------------------------------------------------------------------------
create function public.articles_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      new.author_id := (select auth.uid());
      new.slug := null;
      new.status := 'draft';
      new.comments_locked := false;
      new.submitted_at := null;
      new.published_at := null;
      new.deleted_at := null;
      new.created_at := now();

      -- Spam guard: at most 20 open drafts per author.
      if (select count(*) from public.articles a
          where a.author_id = new.author_id and a.status = 'draft' and a.deleted_at is null) >= 20
      then
        raise exception 'You have too many drafts. Finish or delete some first.'
          using errcode = 'PT429';
      end if;
    elsif new.id is distinct from old.id
      or new.author_id is distinct from old.author_id
      or new.slug is distinct from old.slug
      or new.status is distinct from old.status
      or new.comments_locked is distinct from old.comments_locked
      or new.submitted_at is distinct from old.submitted_at
      or new.published_at is distinct from old.published_at
      or new.created_at is distinct from old.created_at
      or new.deleted_at is distinct from old.deleted_at
    then
      raise exception 'You cannot change protected article fields'
        using errcode = '42501';
    end if;
  end if;

  new.body_text := public.richtext_plain(new.body_json);
  new.updated_at := now();
  return new;
end;
$$;

create trigger articles_before_write
  before insert or update on public.articles
  for each row execute function public.articles_before_write();

-- ---------------------------------------------------------------------------
-- Privileges and policies
-- ---------------------------------------------------------------------------
alter table public.articles enable row level security;

revoke all on public.articles from anon, authenticated;
grant select on public.articles to anon, authenticated;
grant insert (title, dek, body_json, category, content_type) on public.articles to authenticated;
grant update (title, dek, body_json, category, content_type) on public.articles to authenticated;
grant delete on public.articles to authenticated;

-- Published stories are public; authors see their own; staff see everything.
create policy "articles are visible when published, to their author, or to staff"
  on public.articles for select
  to anon, authenticated
  using (
    (status = 'published' and deleted_at is null)
    or (author_id = (select auth.uid()) and deleted_at is null)
    or public.is_staff()
  );

create policy "writers create their own drafts"
  on public.articles for insert
  to authenticated
  with check (author_id = (select auth.uid()) and public.can_write());

create policy "authors edit their own stories"
  on public.articles for update
  to authenticated
  using (public.can_edit_article(id))
  with check (author_id = (select auth.uid()));

-- Only unsubmitted drafts can be hard-deleted (allowed even while suspended).
-- Submitted stories are soft-deleted (Phase 6).
create policy "authors delete their own drafts"
  on public.articles for delete
  to authenticated
  using (author_id = (select auth.uid()) and status = 'draft' and submitted_at is null);

-- Contributor acceptances must point at the caller's own article.
drop policy "users record their own acceptances" on public.agreement_acceptances;
create policy "users record their own acceptances"
  on public.agreement_acceptances for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and (article_id is null or public.can_edit_article(article_id))
  );

-- ---------------------------------------------------------------------------
-- Status RPCs
-- ---------------------------------------------------------------------------
-- Submit a draft: requires a Contributor Agreement acceptance (current version)
-- for this article. New contributors go to review; others publish directly.
-- At most 5 submissions per author per 24 hours.
create function public.submit_article(p_article_id uuid)
returns public.article_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  a public.articles%rowtype;
  target public.article_status;
begin
  if not public.can_write() then
    raise exception 'Your account cannot publish right now' using errcode = '42501';
  end if;

  select * into a from public.articles
  where id = p_article_id and author_id = uid and deleted_at is null
  for update;
  if not found then
    raise exception 'Story not found' using errcode = 'P0002';
  end if;
  if a.status <> 'draft' then
    raise exception 'Only drafts can be submitted' using errcode = '55000';
  end if;

  if char_length(btrim(a.title)) < 5 then
    raise exception 'Add a headline of at least 5 characters' using errcode = '23514';
  end if;
  if a.category is null then
    raise exception 'Choose a category' using errcode = '23514';
  end if;
  if char_length(btrim(a.body_text)) < 1 then
    raise exception 'Write the story before submitting' using errcode = '23514';
  end if;

  if not exists (
    select 1 from public.agreement_acceptances x
    where x.article_id = p_article_id
      and x.user_id = uid
      and x.kind = 'contributor'
      and x.version = public.current_agreement_version('contributor')
  ) then
    raise exception 'Accept the Contributor Agreement to publish' using errcode = '42501';
  end if;

  if (select count(*) from public.articles x
      where x.author_id = uid and x.submitted_at > now() - interval '24 hours') >= 5
  then
    raise exception 'You can publish up to 5 stories a day. Try again tomorrow.'
      using errcode = 'PT429';
  end if;

  target := case when public.can_publish_directly() then 'published' else 'pending_review' end;

  update public.articles set
    status = target,
    slug = coalesce(
      a.slug,
      coalesce(nullif(public.slugify(a.title), ''), 'story')
        || '-' || substr(replace(a.id::text, '-', ''), 1, 6)
    ),
    submitted_at = now(),
    published_at = case when target = 'published' then coalesce(a.published_at, now()) end
  where id = p_article_id;

  return target;
end;
$$;

-- Pull a story back out of the review queue to keep editing.
create function public.withdraw_article(p_article_id uuid)
returns public.article_status
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.articles set status = 'draft', submitted_at = null
  where id = p_article_id
    and author_id = (select auth.uid())
    and status = 'pending_review'
    and deleted_at is null;
  if not found then
    raise exception 'Only stories waiting for review can be withdrawn' using errcode = '55000';
  end if;
  return 'draft';
end;
$$;

revoke execute on function public.submit_article(uuid), public.withdraw_article(uuid) from public, anon;
grant execute on function public.submit_article(uuid), public.withdraw_article(uuid)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Sources (up to 10 per article)
-- ---------------------------------------------------------------------------
create table public.article_sources (
  id bigint generated always as identity primary key,
  article_id uuid not null references public.articles (id) on delete cascade,
  position smallint not null check (position between 0 and 9),
  url text not null check (url ~* '^https?://[^\s/]+' and char_length(url) <= 2000),
  label text check (char_length(label) <= 200),
  unique (article_id, position)
);

alter table public.article_sources enable row level security;
revoke truncate on public.article_sources from anon, authenticated;

create policy "sources follow article visibility"
  on public.article_sources for select
  to anon, authenticated
  using (public.can_view_article(article_id));

create policy "authors manage sources: insert"
  on public.article_sources for insert
  to authenticated
  with check (public.can_edit_article(article_id));

create policy "authors manage sources: update"
  on public.article_sources for update
  to authenticated
  using (public.can_edit_article(article_id))
  with check (public.can_edit_article(article_id));

create policy "authors manage sources: delete"
  on public.article_sources for delete
  to authenticated
  using (public.can_edit_article(article_id));

-- ---------------------------------------------------------------------------
-- Images (up to 3 per article). Files live in the article-images bucket at
-- <author id>/<article id>/<name>.webp
-- ---------------------------------------------------------------------------
create table public.article_images (
  id bigint generated always as identity primary key,
  article_id uuid not null references public.articles (id) on delete cascade,
  position smallint not null check (position between 0 and 2),
  storage_path text not null unique
    check (storage_path ~ ('^[0-9a-f-]{36}/' || article_id::text || '/[a-z0-9-]{1,64}\.webp$')),
  alt_text text not null default '' check (char_length(alt_text) <= 300),
  caption text check (char_length(caption) <= 300),
  credit text check (char_length(credit) <= 120),
  unique (article_id, position)
);

alter table public.article_images enable row level security;
revoke truncate on public.article_images from anon, authenticated;

create policy "images follow article visibility"
  on public.article_images for select
  to anon, authenticated
  using (public.can_view_article(article_id));

create policy "authors manage images: insert"
  on public.article_images for insert
  to authenticated
  with check (
    public.can_edit_article(article_id)
    and split_part(storage_path, '/', 1) = (select auth.uid())::text
  );

create policy "authors manage images: update"
  on public.article_images for update
  to authenticated
  using (public.can_edit_article(article_id))
  with check (
    public.can_edit_article(article_id)
    and split_part(storage_path, '/', 1) = (select auth.uid())::text
  );

create policy "authors manage images: delete"
  on public.article_images for delete
  to authenticated
  using (public.can_edit_article(article_id));

-- ---------------------------------------------------------------------------
-- Storage: article-images bucket (public CDN reads, WebP <= 400 KB; the
-- browser compresses to <= ~250 KB before upload). File names are random, so
-- draft images are not discoverable, but they are not secret either.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('article-images', 'article-images', true, 409600, array['image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "article image owners can read their folder"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'article-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "article image owners upload to their editable articles"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'article-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and case
      when (storage.foldername(name))[2] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then public.can_edit_article(((storage.foldername(name))[2])::uuid)
      else false
    end
  );

-- Removing your own files is always allowed (cleanup, account deletion).
create policy "article image owners delete their files"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'article-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
