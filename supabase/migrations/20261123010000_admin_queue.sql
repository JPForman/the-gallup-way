-- Step 6.3: read functions for the /admin dashboard (staff only).
--
--   * admin_stats(): counts for the stat tiles.
--   * admin_report_queue(): open reports grouped by item, high priority first,
--     then oldest, with a short summary of each item.
--   * admin_new_users(): recent sign-ups with account status (columns clients
--     can't normally read, like suspended_until).
-- Staff already read articles, reports and moderation_actions through RLS;
-- these exist to aggregate and to reach protected profile columns.

create function public.admin_stats()
returns table (open_reports integer, high_priority_reports integer, pending_stories integer, new_users_7d integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_staff() then
    raise exception 'Staff only' using errcode = '42501';
  end if;
  return query select
    (select count(*)::int from public.reports r where r.status = 'open'),
    (select count(*)::int from public.reports r where r.status = 'open' and r.priority = 'high'),
    (select count(*)::int from public.articles a where a.status = 'pending_review' and a.deleted_at is null),
    (select count(*)::int from public.profiles p where p.created_at > now() - interval '7 days');
end;
$$;

create function public.admin_report_queue(p_limit integer default 50)
returns table (
  target_type public.report_target,
  article_id uuid,
  comment_id bigint,
  profile_id uuid,
  report_count integer,
  high boolean,
  first_reported_at timestamptz,
  reasons text[],
  details text[],
  report_ids bigint[],
  -- Article title, comment text, or profile display name.
  summary text,
  -- Story slug (for articles and comments) and the handle of the item's author.
  slug text,
  handle text,
  -- Article status; 'removed' / 'deleted' / 'visible' for comments; 'suspended' / 'active' for profiles.
  item_state text
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
  with g as (
    select r.target_type, r.article_id, r.comment_id, r.profile_id,
      count(*)::int as n,
      bool_or(r.priority = 'high') as high,
      min(r.created_at) as first_at,
      array_agg(distinct r.reason::text) as reasons,
      array_remove(array_agg(r.details order by r.created_at), null) as details,
      array_agg(r.id order by r.created_at) as ids
    from public.reports r
    where r.status = 'open'
    group by r.target_type, r.article_id, r.comment_id, r.profile_id
  )
  select g.target_type, g.article_id, g.comment_id, g.profile_id, g.n, g.high, g.first_at, g.reasons, g.details, g.ids,
    case g.target_type
      when 'article' then a.title
      when 'comment' then left(c.body, 280)
      else p.display_name
    end,
    coalesce(a.slug, ca.slug),
    case g.target_type
      when 'article' then ap.handle
      when 'comment' then cp.handle
      else p.handle
    end,
    case g.target_type
      when 'article' then a.status::text
      when 'comment' then case when c.removed_at is not null then 'removed' when c.deleted_at is not null then 'deleted' else 'visible' end
      else case when p.suspended_until > now() then 'suspended' else 'active' end
    end
  from g
  left join public.articles a on a.id = g.article_id
  left join public.profiles ap on ap.id = a.author_id
  left join public.comments c on c.id = g.comment_id
  left join public.articles ca on ca.id = c.article_id
  left join public.profiles cp on cp.id = c.author_id
  left join public.profiles p on p.id = g.profile_id
  order by g.high desc, g.first_at asc
  limit least(greatest(coalesce(p_limit, 50), 1), 200);
end;
$$;

create function public.admin_new_users(p_limit integer default 50)
returns table (
  id uuid,
  handle text,
  display_name text,
  role public.user_role,
  created_at timestamptz,
  suspended_until timestamptz,
  approved_article_count integer,
  stories integer,
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
  select p.id, p.handle, p.display_name, p.role, p.created_at, p.suspended_until, p.approved_article_count,
    (select count(*)::int from public.articles a where a.author_id = p.id and a.deleted_at is null and a.submitted_at is not null),
    (select count(*)::int from public.reports r where r.status = 'open'
       and (r.profile_id = p.id
         or r.article_id in (select a.id from public.articles a where a.author_id = p.id)
         or r.comment_id in (select c.id from public.comments c where c.author_id = p.id)))
  from public.profiles p
  order by p.created_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 200);
end;
$$;

revoke execute on function public.admin_stats(), public.admin_report_queue(integer), public.admin_new_users(integer) from public, anon;
grant execute on function public.admin_stats(), public.admin_report_queue(integer), public.admin_new_users(integer) to authenticated, service_role;
