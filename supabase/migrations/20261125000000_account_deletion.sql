-- Step 6.6: account deletion (self-service).
--
-- The app calls prepare_account_deletion(mode) as the signed-in user, removes
-- the returned files from Storage, then deletes the auth user with the
-- service-role key. Deleting auth.users cascades to profiles, and from there:
--   * likes, follows, bookmarks, reports ABOUT the profile: deleted (cascade)
--   * stories, comments, corrections, revisions, reports BY them, log rows,
--     agreement acceptances: kept with the person cleared (set null), shown
--     as "Former member"
--
-- Modes:
--   * 'anonymize': published stories stay (as "Former member"); everything
--     unpublished (drafts, pending, hidden, soft-deleted) is deleted.
--   * 'delete': all their stories are deleted, and the text of their comments
--     elsewhere is erased (the placeholder keeps replies in place).
-- Admins can't delete themselves (the site must keep an admin): another admin
-- changes their role first.

create function public.prepare_account_deletion(p_mode text)
returns table (bucket text, path text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  doomed uuid[];
begin
  if uid is null then
    raise exception 'Sign in first' using errcode = '42501';
  end if;
  if p_mode not in ('anonymize', 'delete') then
    raise exception 'Unknown mode %', p_mode using errcode = '22023';
  end if;
  if (select p.role from public.profiles p where p.id = uid) = 'admin' then
    raise exception 'Admins can''t delete their own account. Ask another admin to change your role first.'
      using errcode = '42501';
  end if;

  select coalesce(array_agg(a.id), '{}') into doomed
  from public.articles a
  where a.author_id = uid
    and (p_mode = 'delete' or a.status <> 'published' or a.deleted_at is not null);

  -- Files to remove: photos of the stories being deleted, and the avatar.
  return query
    select 'article-images'::text, i.storage_path from public.article_images i where i.article_id = any(doomed)
    union all
    select 'avatars'::text, p.avatar_path from public.profiles p where p.id = uid and p.avatar_path is not null;

  delete from public.articles a where a.id = any(doomed);

  if p_mode = 'delete' then
    update public.comments c
      set body = '', deleted_at = now()
    where c.author_id = uid and c.deleted_at is null;
  end if;
end;
$$;

revoke execute on function public.prepare_account_deletion(text) from public, anon;
grant execute on function public.prepare_account_deletion(text) to authenticated, service_role;
