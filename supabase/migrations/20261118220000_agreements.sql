-- Step 2.2: versioned agreements (Terms, Privacy, Contributor) and acceptance records.
--
-- * agreement_versions: one row per published version; text lives in
--   src/content/legal.ts and is identified by its SHA-256 (src/content/agreements.ts).
-- * agreement_acceptances: who accepted which version, when, with a salted IP hash.
--   Sign-up acceptances are recorded by the signup trigger from user metadata
--   (no session exists before email confirmation). Later acceptances (re-accepting
--   new Terms, the per-article Contributor Agreement) are inserted by the user.
-- * can_write() now also requires the 18+ attestation and acceptance of the
--   CURRENT Terms and Privacy versions.

-- ---------------------------------------------------------------------------
-- Versions
-- ---------------------------------------------------------------------------
create type public.agreement_kind as enum ('terms', 'privacy', 'contributor');

create table public.agreement_versions (
  kind public.agreement_kind not null,
  version integer not null check (version > 0),
  text_sha256 text not null check (text_sha256 ~ '^[0-9a-f]{64}$'),
  effective_at timestamptz not null default now(),
  primary key (kind, version)
);

comment on table public.agreement_versions is 'Published agreement versions. Insert a new row (via migration) whenever the text changes.';

alter table public.agreement_versions enable row level security;
revoke insert, update, delete, truncate on public.agreement_versions from anon, authenticated;

create policy "agreement versions are readable by everyone"
  on public.agreement_versions for select
  to anon, authenticated
  using (true);

-- Must match src/content/agreements.ts (checked by src/content/agreements.test.ts).
insert into public.agreement_versions (kind, version, text_sha256) values
  ('terms', 1, 'bc7a6edcb0ad357ba0906780abc7f9ced54beb9d832ac22dafc839e60308bb7e'),
  ('privacy', 1, '6f5e66b487b42b45e6c360acc72cf4e4a48c5d84fb068646b10d27f739abf83a'),
  ('contributor', 1, '0734363b20cb4f8cf2ecd1b7a7c9ba64d0a212787a4827d5b8c933b5da913ec7');

create function public.current_agreement_version(k public.agreement_kind)
returns integer
language sql
stable
set search_path = ''
as $$
  select max(v.version) from public.agreement_versions v
  where v.kind = k and v.effective_at <= now();
$$;

-- ---------------------------------------------------------------------------
-- Acceptances
-- ---------------------------------------------------------------------------
create table public.agreement_acceptances (
  id bigint generated always as identity primary key,
  -- Nullable + set null: deleting an account anonymizes its acceptance records
  -- instead of erasing evidence that the agreement was accepted.
  user_id uuid references auth.users (id) on delete set null,
  kind public.agreement_kind not null,
  version integer not null,
  -- Contributor acceptances belong to an article (FK added with the articles table).
  article_id uuid,
  -- sha256(salt || ip), hex. Never the raw IP.
  ip_hash text check (ip_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  foreign key (kind, version) references public.agreement_versions (kind, version),
  check ((kind = 'contributor') = (article_id is not null))
);

create index agreement_acceptances_user_kind_idx
  on public.agreement_acceptances (user_id, kind, version);
create index agreement_acceptances_article_idx
  on public.agreement_acceptances (article_id) where article_id is not null;

alter table public.agreement_acceptances enable row level security;
-- Acceptance records are append-only for clients.
revoke update, delete, truncate on public.agreement_acceptances from anon, authenticated;

create policy "users read own acceptances; staff read all"
  on public.agreement_acceptances for select
  to authenticated
  using (user_id = (select auth.uid()) or public.is_staff());

create policy "users record their own acceptances"
  on public.agreement_acceptances for insert
  to authenticated
  with check (user_id = (select auth.uid()));

-- Clients can't backdate or pick an old version: the server sets owner,
-- version (always current) and timestamp.
create function public.set_acceptance_defaults()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') then
    new.user_id := (select auth.uid());
    new.version := public.current_agreement_version(new.kind);
    new.created_at := now();
  end if;
  return new;
end;
$$;

create trigger agreement_acceptances_defaults
  before insert on public.agreement_acceptances
  for each row execute function public.set_acceptance_defaults();

-- ---------------------------------------------------------------------------
-- 18+ attestation on the profile (protected column)
-- ---------------------------------------------------------------------------
alter table public.profiles add column age_confirmed_at timestamptz;

create or replace function public.guard_profile_update()
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
      or new.age_confirmed_at is distinct from old.age_confirmed_at
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

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create function public.has_accepted_current(k public.agreement_kind)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.agreement_acceptances a
    where a.user_id = (select auth.uid())
      and a.kind = k
      and a.version = public.current_agreement_version(k)
  );
$$;

-- Signed in, not suspended, 18+ attested, and has accepted the current
-- Terms and Privacy Policy.
create or replace function public.can_write()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and not public.is_suspended()
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.age_confirmed_at is not null
    )
    and public.has_accepted_current('terms')
    and public.has_accepted_current('privacy');
$$;

revoke execute on function public.has_accepted_current(public.agreement_kind) from public;
grant execute on function public.has_accepted_current(public.agreement_kind)
  to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Signup trigger: also record 18+ attestation and Terms/Privacy acceptance.
-- Metadata (sent by the app's sign-up Server Action):
--   handle, display_name, age_confirmed (bool),
--   accepted_terms_version, accepted_privacy_version (int), ip_hash (hex)
-- Acceptances are recorded only if the submitted version is the current one.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  wanted_handle text := lower(btrim(coalesce(meta ->> 'handle', '')));
  wanted_name text := btrim(coalesce(meta ->> 'display_name', ''));
  fallback_handle text := 'user_' || substr(replace(new.id::text, '-', ''), 1, 12);
  final_handle text;
  ip text := case when (meta ->> 'ip_hash') ~ '^[0-9a-f]{64}$' then meta ->> 'ip_hash' end;
  terms_v integer := public.current_agreement_version('terms');
  privacy_v integer := public.current_agreement_version('privacy');
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

  insert into public.profiles (id, handle, display_name, age_confirmed_at)
  values (
    new.id,
    final_handle,
    wanted_name,
    case when meta ->> 'age_confirmed' = 'true' then now() end
  );

  if (meta ->> 'accepted_terms_version') = terms_v::text then
    insert into public.agreement_acceptances (user_id, kind, version, ip_hash)
    values (new.id, 'terms', terms_v, ip);
  end if;

  if (meta ->> 'accepted_privacy_version') = privacy_v::text then
    insert into public.agreement_acceptances (user_id, kind, version, ip_hash)
    values (new.id, 'privacy', privacy_v, ip);
  end if;

  return new;
end;
$$;
