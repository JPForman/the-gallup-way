-- Step 3.5: article revisions (edit history after publishing) and corrections.
--
--   * article_revisions: every content change to a story that has been
--     published snapshots the PREVIOUS title/dek/body. Written only by the
--     trigger; readable by staff only (revision history view arrives in 6.5).
--   * corrections: short plain-text notes appended to a published story by its
--     author (while can_write()) or by staff. Public when the story is
--     visible. Append-only: no client updates or deletes.

-- ---------------------------------------------------------------------------
-- Revisions
-- ---------------------------------------------------------------------------
create table public.article_revisions (
  id bigint generated always as identity primary key,
  article_id uuid not null references public.articles (id) on delete cascade,
  title text not null,
  dek text,
  body_json jsonb not null,
  -- Who made the change that replaced this version (null after account deletion).
  edited_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.article_revisions is
  'Previous versions of published stories. Written by the articles_snapshot_revision trigger only.';

create index article_revisions_article_idx on public.article_revisions (article_id, created_at desc);

alter table public.article_revisions enable row level security;
revoke all on public.article_revisions from anon, authenticated;
grant select on public.article_revisions to authenticated;

create policy "staff read revisions"
  on public.article_revisions for select
  to authenticated
  using (public.is_staff());

-- SECURITY DEFINER so it can write the table clients have no grants on.
create function public.articles_snapshot_revision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.published_at is not null
    and (new.title is distinct from old.title
      or new.dek is distinct from old.dek
      or new.body_json is distinct from old.body_json)
  then
    insert into public.article_revisions (article_id, title, dek, body_json, edited_by)
    values (old.id, old.title, old.dek, old.body_json, (select auth.uid()));
  end if;
  return null;
end;
$$;

revoke execute on function public.articles_snapshot_revision() from public, anon, authenticated;

create trigger articles_snapshot_revision
  after update of title, dek, body_json on public.articles
  for each row execute function public.articles_snapshot_revision();

-- ---------------------------------------------------------------------------
-- Corrections
-- ---------------------------------------------------------------------------
create table public.corrections (
  id bigint generated always as identity primary key,
  article_id uuid not null references public.articles (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.corrections is 'Append-only corrections shown as a dated box on the article.';

create index corrections_article_idx on public.corrections (article_id, created_at);
create index corrections_created_by_idx on public.corrections (created_by, created_at);

-- The caller may add a correction: the story is published and not deleted,
-- and the caller can write and is its author or staff.
create function public.can_correct_article(p_article_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.can_write() and exists (
    select 1 from public.articles a
    where a.id = p_article_id
      and a.status = 'published'
      and a.deleted_at is null
      and (a.author_id = (select auth.uid()) or public.is_staff())
  );
$$;

revoke execute on function public.can_correct_article(uuid) from public;
grant execute on function public.can_correct_article(uuid) to anon, authenticated, service_role;

-- Clients can't forge the author or the date. Spam guard: 10 per user per day.
create function public.corrections_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') then
    new.created_by := (select auth.uid());
    new.created_at := now();
    if (select count(*) from public.corrections c
        where c.created_by = new.created_by and c.created_at > now() - interval '24 hours') >= 10
    then
      raise exception 'You can add up to 10 corrections a day. Try again tomorrow.'
        using errcode = 'PT429';
    end if;
  end if;
  new.body := btrim(new.body);
  return new;
end;
$$;

create trigger corrections_before_insert
  before insert on public.corrections
  for each row execute function public.corrections_before_insert();

alter table public.corrections enable row level security;
revoke all on public.corrections from anon, authenticated;
grant select on public.corrections to anon, authenticated;
grant insert (article_id, body) on public.corrections to authenticated;

create policy "corrections follow article visibility"
  on public.corrections for select
  to anon, authenticated
  using (public.can_view_article(article_id));

create policy "authors and staff add corrections to published stories"
  on public.corrections for insert
  to authenticated
  with check (created_by = (select auth.uid()) and public.can_correct_article(article_id));
