-- Step 6.4: one account, for the staff account page (/admin/users/[id]).
-- Includes columns clients can't normally read (suspension, approval count).
-- No email: staff contact members through the site, and the less personal
-- data on screen the better.

create function public.admin_user(p_profile_id uuid)
returns table (
  id uuid,
  handle text,
  display_name text,
  bio text,
  role public.user_role,
  created_at timestamptz,
  suspended_until timestamptz,
  approved_article_count integer,
  published integer,
  pending integer,
  hidden integer,
  comments integer,
  open_reports integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_staff() then
    raise exception 'Staff only' using errcode = '42501';
  end if;
  return query
  select p.id, p.handle, p.display_name, p.bio, p.role, p.created_at, p.suspended_until, p.approved_article_count,
    (select count(*)::int from public.articles a where a.author_id = p.id and a.status = 'published' and a.deleted_at is null),
    (select count(*)::int from public.articles a where a.author_id = p.id and a.status = 'pending_review' and a.deleted_at is null),
    (select count(*)::int from public.articles a where a.author_id = p.id and a.status = 'hidden' and a.deleted_at is null),
    (select count(*)::int from public.comments c where c.author_id = p.id and c.deleted_at is null),
    (select count(*)::int from public.reports r where r.status = 'open'
       and (r.profile_id = p.id
         or r.article_id in (select a.id from public.articles a where a.author_id = p.id)
         or r.comment_id in (select c.id from public.comments c where c.author_id = p.id)))
  from public.profiles p
  where p.id = p_profile_id;
end;
$$;

revoke execute on function public.admin_user(uuid) from public, anon;
grant execute on function public.admin_user(uuid) to authenticated, service_role;
