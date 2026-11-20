-- Step 6.5: soft delete by authors, restore by staff.
--
--   * delete_article(): authors remove their own submitted story (any status).
--     Sets deleted_at; the story drops out of every public list and page, the
--     slug stays reserved, photos and history are kept. Allowed while
--     suspended (it only removes your own content). Unsubmitted drafts are
--     still hard-deleted by the author (articles delete policy).
--   * staff_article_action(..., 'restore_deleted', ...) brings it back, logged.
--   * Staff already read revisions (article_revisions, RLS); the history view
--     is UI only.

alter type public.moderation_action_kind add value if not exists 'restore_deleted_article';

create function public.delete_article(p_article_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.articles
    set deleted_at = now()
  where id = p_article_id
    and author_id = (select auth.uid())
    and deleted_at is null
    and submitted_at is not null;
  return found;
end;
$$;

revoke execute on function public.delete_article(uuid) from public, anon;
grant execute on function public.delete_article(uuid) to authenticated, service_role;

create or replace function public.staff_article_action(
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
  select * into a from public.articles where id = p_article_id for update;
  if not found or (a.deleted_at is not null and p_action <> 'restore_deleted') then
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
    when 'restore_deleted' then
      if a.deleted_at is null then
        raise exception 'This story isn''t deleted' using errcode = '55000';
      end if;
      kind := 'restore_deleted_article';
      update public.articles set deleted_at = null where id = a.id;
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
    p_details => jsonb_build_object('from', a.status, 'to', next_status, 'was_deleted', a.deleted_at is not null));
  return next_status;
end;
$$;

