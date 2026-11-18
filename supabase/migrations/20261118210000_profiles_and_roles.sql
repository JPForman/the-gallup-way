-- Step 2.1: profiles, roles, and the authorization helpers used by every later policy.
--
-- Trust model:
--   * Clients (roles `anon`, `authenticated`) go through RLS.
--   * Protected profile columns (role, suspension, approval count) can only be
--     changed by SECURITY DEFINER functions (which run as the table owner and
--     write a moderation log row; added in Phase 6) or by service_role scripts.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('user', 'moderator', 'admin');

-- ---------------------------------------------------------------------------
-- Handles
-- ---------------------------------------------------------------------------
-- Lowercase letters, digits, underscore; 3-30 chars; not a reserved word.
create function public.is_valid_handle(h text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select h is not null
    and h ~ '^[a-z0-9_]{3,30}$'
    and h not in (
      'admin', 'administrator', 'moderator', 'mod', 'staff', 'support', 'help',
      'official', 'system', 'root', 'null', 'undefined', 'anonymous',
      'thegallupway', 'gallupway', 'gallup_way', 'the_gallup_way',
      'me', 'settings', 'write', 'edit', 'search', 'saved', 'legal', 'auth',
      'api', 'admin_', 'contact', 'about', 'new'
    );
$$;

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  handle text not null unique check (public.is_valid_handle(handle)),
  display_name text not null check (char_length(btrim(display_name)) between 1 and 60),
  bio text check (char_length(bio) <= 500),
  avatar_path text check (char_length(avatar_path) <= 300),
  role public.user_role not null default 'user',
  -- null = active; future timestamp = suspended until then; 'infinity' = banned.
  suspended_until timestamptz,
  -- Number of this author's stories approved by staff; >= 3 publishes directly.
  approved_article_count integer not null default 0 check (approved_article_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'Public profile for each auth user. Email lives only in auth.users and is never exposed.';

alter table public.profiles enable row level security;

-- Defense in depth: clients never insert or delete profiles directly.
revoke insert, delete, truncate on public.profiles from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Authorization helpers (used in RLS policies everywhere)
-- SECURITY DEFINER so they can read profiles regardless of the caller's RLS.
-- ---------------------------------------------------------------------------
create function public.current_role_name()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role from public.profiles p where p.id = (select auth.uid());
$$;

create function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.role in ('moderator', 'admin') from public.profiles p where p.id = (select auth.uid())),
    false
  );
$$;

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.role = 'admin' from public.profiles p where p.id = (select auth.uid())),
    false
  );
$$;

create function public.is_suspended()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.suspended_until is not null and p.suspended_until > now()
       from public.profiles p where p.id = (select auth.uid())),
    false
  );
$$;

-- Signed in (email-verified: unverified users cannot get a session because
-- email confirmations are required) and not suspended.
create function public.can_write()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and not public.is_suspended();
$$;

-- New-contributor review: authors with fewer than 3 approved stories go to review.
create function public.can_publish_directly()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.approved_article_count >= 3 or p.role in ('moderator', 'admin')
       from public.profiles p where p.id = (select auth.uid())),
    false
  );
$$;

revoke execute on function
  public.current_role_name(), public.is_staff(), public.is_admin(),
  public.is_suspended(), public.can_write(), public.can_publish_directly()
from public;
grant execute on function
  public.current_role_name(), public.is_staff(), public.is_admin(),
  public.is_suspended(), public.can_write(), public.can_publish_directly()
to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------------
-- Profiles are public (bylines, profile pages).
create policy "profiles are readable by everyone"
  on public.profiles for select
  to anon, authenticated
  using (true);

-- Users edit their own profile while not suspended. Protected columns are
-- guarded by the trigger below.
create policy "users update own profile"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()) and not public.is_suspended())
  with check (id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Guard trigger: clients can't change protected columns, even on their own row.
-- Inside SECURITY DEFINER functions current_user is the owner, so trusted
-- staff functions (Phase 6) and service_role scripts pass.
-- ---------------------------------------------------------------------------
create function public.guard_profile_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if new.id is distinct from old.id
      or new.role is distinct from old.role
      or new.suspended_until is distinct from old.suspended_until
      or new.approved_article_count is distinct from old.approved_article_count
      or new.created_at is distinct from old.created_at
    then
      raise exception 'You cannot change protected profile fields'
        using errcode = '42501';
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_guard_update
  before update on public.profiles
  for each row execute function public.guard_profile_update();

-- ---------------------------------------------------------------------------
-- Create a profile for every new auth user.
-- Sign-up sends `handle` and `display_name` in user metadata (validated by Zod
-- in the app). If the handle is invalid or taken, fall back to user_<id> so
-- sign-up never fails here; the user can change it in Settings.
-- ---------------------------------------------------------------------------
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  wanted_handle text := lower(btrim(coalesce(new.raw_user_meta_data ->> 'handle', '')));
  wanted_name text := btrim(coalesce(new.raw_user_meta_data ->> 'display_name', ''));
  fallback_handle text := 'user_' || substr(replace(new.id::text, '-', ''), 1, 12);
  final_handle text;
begin
  if public.is_valid_handle(wanted_handle)
     and not exists (select 1 from public.profiles p where p.handle = wanted_handle)
  then
    final_handle := wanted_handle;
  else
    final_handle := fallback_handle;
  end if;

  if char_length(wanted_name) not between 1 and 60 then
    wanted_name := final_handle;
  end if;

  insert into public.profiles (id, handle, display_name)
  values (new.id, final_handle, wanted_name);

  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
