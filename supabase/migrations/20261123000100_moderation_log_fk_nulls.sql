-- Fix for 20261123000000_moderation.sql: deleting a story, comment, report or
-- account must still work when the log mentions it. Those foreign keys are
-- `on delete set null`, which Postgres applies as an UPDATE on
-- moderation_actions, and the append-only trigger blocked it.
--
-- Allowed now: an UPDATE that only clears reference columns to null.
-- Still blocked: DELETE, and any other change.

create or replace function public.moderation_actions_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
    and new.id = old.id
    and new.action = old.action
    and new.reason = old.reason
    and new.details = old.details
    and new.created_at = old.created_at
    and (new.actor_id is not distinct from old.actor_id or new.actor_id is null)
    and (new.article_id is not distinct from old.article_id or new.article_id is null)
    and (new.comment_id is not distinct from old.comment_id or new.comment_id is null)
    and (new.profile_id is not distinct from old.profile_id or new.profile_id is null)
    and (new.report_id is not distinct from old.report_id or new.report_id is null)
  then
    return new;
  end if;
  raise exception 'The moderation log is append-only' using errcode = '42501';
end;
$$;
