-- Step 2.5: column-level privacy on profiles, a private account-status RPC,
-- and the avatars storage bucket.

-- ---------------------------------------------------------------------------
-- Column privileges: the public sees byline fields only.
-- Private fields (age_confirmed_at, suspended_until, approved_article_count,
-- updated_at) are read through my_account() or staff functions.
-- Clients must select explicit columns (no `select *`).
-- ---------------------------------------------------------------------------
revoke select, update on public.profiles from anon, authenticated;

grant select (id, handle, display_name, bio, avatar_path, role, created_at)
  on public.profiles to anon, authenticated;

-- Only these columns are client-editable (RLS limits rows to the caller's own;
-- the guard trigger remains as a second line of defense).
grant update (handle, display_name, bio, avatar_path)
  on public.profiles to authenticated;

-- Avatars must live in the owner's folder: avatars/<user id>/<file>.webp
alter table public.profiles
  add constraint profiles_avatar_path_owner
  check (avatar_path is null or avatar_path ~ ('^' || id::text || '/[a-z0-9-]{1,64}\.webp$'));

-- ---------------------------------------------------------------------------
-- my_account(): the caller's private status, for the settings page and the
-- re-accept / suspension banners.
-- ---------------------------------------------------------------------------
create function public.my_account()
returns table (
  id uuid,
  handle text,
  role public.user_role,
  suspended_until timestamptz,
  age_confirmed boolean,
  approved_article_count integer,
  needs_terms boolean,
  needs_privacy boolean,
  can_write boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id,
    p.handle,
    p.role,
    case when p.suspended_until > now() then p.suspended_until end,
    p.age_confirmed_at is not null,
    p.approved_article_count,
    not public.has_accepted_current('terms'),
    not public.has_accepted_current('privacy'),
    public.can_write()
  from public.profiles p
  where p.id = (select auth.uid());
$$;

revoke execute on function public.my_account() from public, anon;
grant execute on function public.my_account() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Avatars bucket: public read (served from the CDN), small WebP only.
-- Browser compresses to <= ~100 KB before upload.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 204800, array['image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Owners manage files in their own folder while they're allowed to write.
-- (Public reads go through the public bucket URL; no select policy for anon,
-- so the bucket can't be listed.)
create policy "avatar owners can read their folder"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "avatar owners can upload to their folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and not public.is_suspended()
  );

create policy "avatar owners can replace their files"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and not public.is_suspended()
  );

-- Deleting your own photo is always allowed (even while suspended).
create policy "avatar owners can delete their files"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
