-- Step 3.6: articles.edited_at, the time of the last CONTENT change after
-- publishing (the article page shows "Updated ..."). updated_at changes on
-- every save, even no-op saves, so it can't be used for that.
-- Same condition as articles_snapshot_revision (20261119030000).

alter table public.articles add column edited_at timestamptz;

comment on column public.articles.edited_at is
  'Last title/dek/body change after the story was first published. Set by articles_before_write.';

create or replace function public.articles_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      new.author_id := (select auth.uid());
      new.slug := null;
      new.status := 'draft';
      new.comments_locked := false;
      new.submitted_at := null;
      new.published_at := null;
      new.deleted_at := null;
      new.edited_at := null;
      new.created_at := now();

      -- Spam guard: at most 20 open drafts per author.
      if (select count(*) from public.articles a
          where a.author_id = new.author_id and a.status = 'draft' and a.deleted_at is null) >= 20
      then
        raise exception 'You have too many drafts. Finish or delete some first.'
          using errcode = 'PT429';
      end if;
    elsif new.id is distinct from old.id
      or new.author_id is distinct from old.author_id
      or new.slug is distinct from old.slug
      or new.status is distinct from old.status
      or new.comments_locked is distinct from old.comments_locked
      or new.submitted_at is distinct from old.submitted_at
      or new.published_at is distinct from old.published_at
      or new.created_at is distinct from old.created_at
      or new.deleted_at is distinct from old.deleted_at
      or new.edited_at is distinct from old.edited_at
    then
      raise exception 'You cannot change protected article fields'
        using errcode = '42501';
    end if;
  end if;

  if tg_op = 'UPDATE'
    and old.published_at is not null
    and (new.title is distinct from old.title
      or new.dek is distinct from old.dek
      or new.body_json is distinct from old.body_json)
  then
    new.edited_at := now();
  end if;

  new.body_text := public.richtext_plain(new.body_json);
  new.updated_at := now();
  return new;
end;
$$;
