-- Step 6.1: reports, the moderation log, and staff action functions.
--
--   * reports: writers (can_write()) report an article, comment or profile with
--     a reason. Priority is derived: threat, defamation and copyright are high.
--     One open report per reporter per item; 30 reports/day/user (PT429).
--     Reporters see their own reports; staff see all. Nobody edits them
--     directly; staff close them through the functions below.
--   * moderation_actions: append-only log, staff-only read, written only by
--     the SECURITY DEFINER staff functions in the same transaction as the action.
--   * Staff functions (all require is_staff() and a reason):
--       staff_article_action  hide | restore | approve | reject | lock_comments | unlock_comments
--       staff_comment_action  remove | restore
--       staff_user_action     suspend (until) | unsuspend | ban
--       set_user_role         admin only
--       dismiss_report, add_staff_note
--     Corrective actions (hide, remove, suspend, ban) close every open report
--     on that item. Staff never edit what users wrote.
--   * Staff comment removal blanks the text like an author delete and sets
--     removed_at; the original text is kept in the log so it can be restored.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.report_reason as enum ('defamation', 'harassment', 'copyright', 'spam', 'threat', 'other');
create type public.report_target as enum ('article', 'comment', 'profile');
create type public.report_status as enum ('open', 'resolved', 'dismissed');
create type public.moderation_action_kind as enum (
  'hide_article', 'restore_article', 'approve_article', 'reject_article',
  'lock_comments', 'unlock_comments',
  'remove_comment', 'restore_comment',
  'suspend_user', 'unsuspend_user', 'ban_user', 'change_role',
  'dismiss_report', 'note'
);

-- ---------------------------------------------------------------------------
-- Comments removed by staff
-- ---------------------------------------------------------------------------
alter table public.comments add column removed_at timestamptz;
alter table public.comments add constraint comments_removed_is_deleted
  check (removed_at is null or deleted_at is not null);
comment on column public.comments.removed_at is 'Set when staff removed the comment (deleted_at is set too; text kept in moderation_actions).';

create or replace function public.comments_before_insert()
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
    new.removed_at := null;

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

-- ---------------------------------------------------------------------------
-- reports
-- ---------------------------------------------------------------------------
create table public.reports (
  id bigint generated always as identity primary key,
  -- Null after the reporter deletes their account.
  reporter_id uuid default auth.uid() references public.profiles (id) on delete set null,
  target_type public.report_target not null,
  article_id uuid references public.articles (id) on delete cascade,
  comment_id bigint references public.comments (id) on delete cascade,
  profile_id uuid references public.profiles (id) on delete cascade,
  reason public.report_reason not null,
  details text,
  priority text not null generated always as (
    case when reason in ('threat', 'defamation', 'copyright') then 'high' else 'normal' end
  ) stored,
  status public.report_status not null default 'open',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles (id) on delete set null,
  constraint reports_one_target check (
    (target_type = 'article' and article_id is not null and comment_id is null and profile_id is null)
    or (target_type = 'comment' and comment_id is not null and article_id is null and profile_id is null)
    or (target_type = 'profile' and profile_id is not null and article_id is null and comment_id is null)
  ),
  constraint reports_details_length check (details is null or char_length(details) <= 1000),
  constraint reports_other_needs_details check (reason <> 'other' or char_length(btrim(coalesce(details, ''))) > 0),
  constraint reports_resolution check ((status = 'open') = (resolved_at is null))
);

comment on table public.reports is 'User reports of articles, comments and profiles. Staff queue; closed via staff functions.';

create unique index reports_one_open_per_reporter on public.reports (reporter_id, article_id, comment_id, profile_id)
  nulls not distinct where status = 'open';
create index reports_queue_idx on public.reports (priority, created_at) where status = 'open';
create index reports_article_idx on public.reports (article_id) where article_id is not null;
create index reports_comment_idx on public.reports (comment_id) where comment_id is not null;
create index reports_profile_idx on public.reports (profile_id) where profile_id is not null;
create index reports_reporter_idx on public.reports (reporter_id, created_at);

-- The item exists and the caller can see it.
create function public.can_report(p_target public.report_target, p_article_id uuid, p_comment_id bigint, p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case p_target
    when 'article' then public.can_view_article(p_article_id)
    when 'comment' then exists (
      select 1 from public.comments c
      where c.id = p_comment_id and c.deleted_at is null and public.can_view_article(c.article_id))
    when 'profile' then exists (select 1 from public.profiles p where p.id = p_profile_id)
  end;
$$;

revoke execute on function public.can_report(public.report_target, uuid, bigint, uuid) from public;
grant execute on function public.can_report(public.report_target, uuid, bigint, uuid) to authenticated, service_role;

create function public.reports_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') then
    new.reporter_id := (select auth.uid());
    new.status := 'open';
    new.created_at := now();
    new.resolved_at := null;
    new.resolved_by := null;
    if (select count(*) from public.reports r
        where r.reporter_id = new.reporter_id and r.created_at > now() - interval '24 hours') >= 30
    then
      raise exception 'You can send up to 30 reports a day. Try again tomorrow.'
        using errcode = 'PT429';
    end if;
  end if;
  new.details := nullif(btrim(new.details), '');
  return new;
end;
$$;

create trigger reports_before_insert
  before insert on public.reports
  for each row execute function public.reports_before_insert();

alter table public.reports enable row level security;
grant select on public.reports to authenticated;
grant insert (target_type, article_id, comment_id, profile_id, reason, details) on public.reports to authenticated;

create policy "reporters see their reports; staff see all"
  on public.reports for select
  to authenticated
  using (reporter_id = (select auth.uid()) or public.is_staff());

create policy "writers report visible items"
  on public.reports for insert
  to authenticated
  with check (
    reporter_id = (select auth.uid())
    and public.can_write()
    and public.can_report(target_type, article_id, comment_id, profile_id)
  );

-- ---------------------------------------------------------------------------
-- moderation_actions (append-only)
-- ---------------------------------------------------------------------------
create table public.moderation_actions (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  action public.moderation_action_kind not null,
  article_id uuid references public.articles (id) on delete set null,
  comment_id bigint references public.comments (id) on delete set null,
  profile_id uuid references public.profiles (id) on delete set null,
  report_id bigint references public.reports (id) on delete set null,
  reason text not null check (char_length(reason) between 1 and 1000),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.moderation_actions is 'Append-only staff action log. Written only by staff SQL functions.';

create index moderation_actions_created_idx on public.moderation_actions (created_at desc);
create index moderation_actions_article_idx on public.moderation_actions (article_id) where article_id is not null;
create index moderation_actions_comment_idx on public.moderation_actions (comment_id) where comment_id is not null;
create index moderation_actions_profile_idx on public.moderation_actions (profile_id) where profile_id is not null;

alter table public.moderation_actions enable row level security;
grant select on public.moderation_actions to authenticated;

create policy "staff read the log"
  on public.moderation_actions for select
  to authenticated
  using (public.is_staff());

-- Even the owner can't rewrite history by accident.
create function public.moderation_actions_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'The moderation log is append-only' using errcode = '42501';
end;
$$;

create trigger moderation_actions_append_only
  before update or delete on public.moderation_actions
  for each row execute function public.moderation_actions_append_only();

-- ---------------------------------------------------------------------------
-- Internal helpers (not callable by clients)
-- ---------------------------------------------------------------------------
create function public.mod_require_staff(p_reason text)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_staff() then
    raise exception 'Staff only' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) not between 1 and 1000 then
    raise exception 'A reason (up to 1000 characters) is required' using errcode = '22023';
  end if;
  return btrim(p_reason);
end;
$$;

create function public.mod_log(
  p_action public.moderation_action_kind,
  p_reason text,
  p_article_id uuid default null,
  p_comment_id bigint default null,
  p_profile_id uuid default null,
  p_report_id bigint default null,
  p_details jsonb default '{}'::jsonb
)
returns bigint
language sql
security definer
set search_path = ''
as $$
  insert into public.moderation_actions (actor_id, action, article_id, comment_id, profile_id, report_id, reason, details)
  values ((select auth.uid()), p_action, p_article_id, p_comment_id, p_profile_id, p_report_id, p_reason, coalesce(p_details, '{}'::jsonb))
  returning id;
$$;

-- Close every open report on one item.
create function public.mod_close_reports(p_article_id uuid, p_comment_id bigint, p_profile_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  update public.reports r
    set status = 'resolved', resolved_at = now(), resolved_by = (select auth.uid())
  where r.status = 'open'
    and (
      (p_article_id is not null and r.article_id = p_article_id)
      or (p_comment_id is not null and r.comment_id = p_comment_id)
      or (p_profile_id is not null and r.profile_id = p_profile_id)
    );
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke execute on function public.mod_require_staff(text) from public, anon, authenticated;
revoke execute on function public.mod_log(public.moderation_action_kind, text, uuid, bigint, uuid, bigint, jsonb) from public, anon, authenticated;
revoke execute on function public.mod_close_reports(uuid, bigint, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Staff actions
-- ---------------------------------------------------------------------------

-- Articles: hide | restore | approve | reject | lock_comments | unlock_comments.
-- Returns the article's status afterwards.
create function public.staff_article_action(
  p_article_id uuid,
  p_action text,
  p_reason text,
  p_report_id bigint default null
)
returns public.article_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  reason text := public.mod_require_staff(p_reason);
  a public.articles%rowtype;
  kind public.moderation_action_kind;
  next_status public.article_status;
begin
  select * into a from public.articles where id = p_article_id and deleted_at is null for update;
  if not found then
    raise exception 'Story not found' using errcode = 'P0002';
  end if;

  next_status := a.status;
  case p_action
    when 'hide' then
      if a.status not in ('published', 'pending_review') then
        raise exception 'Only published or pending stories can be hidden' using errcode = '55000';
      end if;
      kind := 'hide_article';
      next_status := 'hidden';
      update public.articles set status = 'hidden' where id = a.id;
      perform public.mod_close_reports(a.id, null, null);
    when 'restore' then
      if a.status <> 'hidden' then
        raise exception 'Only hidden stories can be restored' using errcode = '55000';
      end if;
      kind := 'restore_article';
      next_status := case when a.published_at is not null then 'published' else 'pending_review' end;
      update public.articles set status = next_status where id = a.id;
    when 'approve' then
      if a.status <> 'pending_review' then
        raise exception 'Only stories waiting for review can be approved' using errcode = '55000';
      end if;
      kind := 'approve_article';
      next_status := 'published';
      update public.articles set status = 'published', published_at = coalesce(published_at, now()) where id = a.id;
      update public.profiles set approved_article_count = approved_article_count + 1 where id = a.author_id;
    when 'reject' then
      if a.status <> 'pending_review' then
        raise exception 'Only stories waiting for review can be rejected' using errcode = '55000';
      end if;
      kind := 'reject_article';
      next_status := 'draft';
      update public.articles set status = 'draft', submitted_at = null where id = a.id;
    when 'lock_comments' then
      kind := 'lock_comments';
      update public.articles set comments_locked = true where id = a.id;
    when 'unlock_comments' then
      kind := 'unlock_comments';
      update public.articles set comments_locked = false where id = a.id;
    else
      raise exception 'Unknown action %', p_action using errcode = '22023';
  end case;

  perform public.mod_log(kind, reason, p_article_id => a.id, p_profile_id => a.author_id, p_report_id => p_report_id,
    p_details => jsonb_build_object('from', a.status, 'to', next_status));
  return next_status;
end;
$$;

-- Comments: remove | restore.
create function public.staff_comment_action(
  p_comment_id bigint,
  p_action text,
  p_reason text,
  p_report_id bigint default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  reason text := public.mod_require_staff(p_reason);
  c public.comments%rowtype;
  original text;
begin
  select * into c from public.comments where id = p_comment_id for update;
  if not found then
    raise exception 'Comment not found' using errcode = 'P0002';
  end if;

  case p_action
    when 'remove' then
      if c.deleted_at is not null then
        raise exception 'This comment is already gone' using errcode = '55000';
      end if;
      update public.comments set body = '', deleted_at = now(), removed_at = now() where id = c.id;
      perform public.mod_close_reports(null, c.id, null);
      perform public.mod_log('remove_comment', reason, p_article_id => c.article_id, p_comment_id => c.id,
        p_profile_id => c.author_id, p_report_id => p_report_id, p_details => jsonb_build_object('body', c.body));
    when 'restore' then
      if c.removed_at is null then
        raise exception 'Only comments removed by staff can be restored' using errcode = '55000';
      end if;
      select m.details ->> 'body' into original
      from public.moderation_actions m
      where m.comment_id = c.id and m.action = 'remove_comment'
      order by m.id desc limit 1;
      if original is null then
        raise exception 'The original text was not found' using errcode = 'P0002';
      end if;
      update public.comments set body = original, deleted_at = null, removed_at = null where id = c.id;
      perform public.mod_log('restore_comment', reason, p_article_id => c.article_id, p_comment_id => c.id,
        p_profile_id => c.author_id, p_report_id => p_report_id);
    else
      raise exception 'Unknown action %', p_action using errcode = '22023';
  end case;
  return true;
end;
$$;

-- Users: suspend (until a future time) | unsuspend | ban. Returns suspended_until.
-- Staff can't act on themselves; only admins can act on other staff, and
-- nobody can suspend an admin.
create function public.staff_user_action(
  p_profile_id uuid,
  p_action text,
  p_reason text,
  p_until timestamptz default null,
  p_report_id bigint default null
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  reason text := public.mod_require_staff(p_reason);
  p public.profiles%rowtype;
  kind public.moderation_action_kind;
  next_until timestamptz;
begin
  select * into p from public.profiles where id = p_profile_id for update;
  if not found then
    raise exception 'Profile not found' using errcode = 'P0002';
  end if;
  if p.id = (select auth.uid()) then
    raise exception 'You can''t take this action on your own account' using errcode = '42501';
  end if;
  if p.role = 'admin' or (p.role = 'moderator' and not public.is_admin()) then
    raise exception 'You can''t take this action on this account' using errcode = '42501';
  end if;

  case p_action
    when 'suspend' then
      if p_until is null or p_until <= now() then
        raise exception 'A suspension needs an end date in the future' using errcode = '22023';
      end if;
      kind := 'suspend_user';
      next_until := p_until;
    when 'unsuspend' then
      kind := 'unsuspend_user';
      next_until := null;
    when 'ban' then
      kind := 'ban_user';
      next_until := 'infinity';
    else
      raise exception 'Unknown action %', p_action using errcode = '22023';
  end case;

  update public.profiles set suspended_until = next_until where id = p.id;
  if p_action in ('suspend', 'ban') then
    perform public.mod_close_reports(null, null, p.id);
  end if;
  perform public.mod_log(kind, reason, p_profile_id => p.id, p_report_id => p_report_id,
    p_details => jsonb_build_object('from', p.suspended_until, 'to', next_until));
  return next_until;
end;
$$;

-- Admins change roles (not their own, so the site always keeps an admin).
create function public.set_user_role(p_profile_id uuid, p_role public.user_role, p_reason text)
returns public.user_role
language plpgsql
security definer
set search_path = ''
as $$
declare
  reason text := public.mod_require_staff(p_reason);
  old_role public.user_role;
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  if p_profile_id = (select auth.uid()) then
    raise exception 'You can''t change your own role' using errcode = '42501';
  end if;
  select role into old_role from public.profiles where id = p_profile_id for update;
  if not found then
    raise exception 'Profile not found' using errcode = 'P0002';
  end if;
  if old_role = p_role then
    return p_role;
  end if;
  update public.profiles set role = p_role where id = p_profile_id;
  perform public.mod_log('change_role', reason, p_profile_id => p_profile_id,
    p_details => jsonb_build_object('from', old_role, 'to', p_role));
  return p_role;
end;
$$;

-- Close one report without acting on the item.
create function public.dismiss_report(p_report_id bigint, p_reason text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  reason text := public.mod_require_staff(p_reason);
  r public.reports%rowtype;
begin
  update public.reports
    set status = 'dismissed', resolved_at = now(), resolved_by = (select auth.uid())
  where id = p_report_id and status = 'open'
  returning * into r;
  if not found then
    raise exception 'Open report not found' using errcode = 'P0002';
  end if;
  perform public.mod_log('dismiss_report', reason, p_article_id => r.article_id, p_comment_id => r.comment_id,
    p_profile_id => r.profile_id, p_report_id => r.id);
  return true;
end;
$$;

-- A note on a user, story or comment (warnings, context for other staff).
create function public.add_staff_note(
  p_reason text,
  p_profile_id uuid default null,
  p_article_id uuid default null,
  p_comment_id bigint default null
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  reason text := public.mod_require_staff(p_reason);
begin
  if p_profile_id is null and p_article_id is null and p_comment_id is null then
    raise exception 'A note needs a user, story or comment' using errcode = '22023';
  end if;
  return public.mod_log('note', reason, p_article_id => p_article_id, p_comment_id => p_comment_id, p_profile_id => p_profile_id);
end;
$$;

revoke execute on function
  public.staff_article_action(uuid, text, text, bigint),
  public.staff_comment_action(bigint, text, text, bigint),
  public.staff_user_action(uuid, text, text, timestamptz, bigint),
  public.set_user_role(uuid, public.user_role, text),
  public.dismiss_report(bigint, text),
  public.add_staff_note(text, uuid, uuid, bigint)
from public, anon;
grant execute on function
  public.staff_article_action(uuid, text, text, bigint),
  public.staff_comment_action(bigint, text, text, bigint),
  public.staff_user_action(uuid, text, text, timestamptz, bigint),
  public.set_user_role(uuid, public.user_role, text),
  public.dismiss_report(bigint, text),
  public.add_staff_note(text, uuid, uuid, bigint)
to authenticated, service_role;
