-- Step 3.3: save an article's content, sources and images in one transaction.
--
-- SECURITY INVOKER: runs as the caller, so RLS, column grants and the
-- articles guard trigger all apply exactly as for direct writes.
--
-- p_article_id null/omitted -> create a new draft
-- p_sources          -> [{"url": text, "label": text|null}, ...] (<= 10, in order)
-- p_images           -> [{"storage_path", "alt_text", "caption", "credit"}, ...] (<= 3, in order)
-- Returns {"id", "status", "slug", "removed_paths"}; removed_paths are image
-- files no longer referenced, for the app to delete from Storage.
create function public.save_article(
  p_article_id uuid default null,
  p_title text default '',
  p_dek text default null,
  p_body_json jsonb default null,
  p_category text default null,
  p_content_type public.content_type default 'news',
  p_sources jsonb default '[]'::jsonb,
  p_images jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid := p_article_id;
  v_status public.article_status;
  v_slug text;
  v_removed text[];
begin
  p_sources := coalesce(p_sources, '[]'::jsonb);
  p_images := coalesce(p_images, '[]'::jsonb);
  if jsonb_typeof(p_sources) <> 'array' or jsonb_typeof(p_images) <> 'array' then
    raise exception 'Sources and images must be lists' using errcode = '22023';
  end if;
  if jsonb_array_length(p_sources) > 10 then
    raise exception 'A story can have at most 10 sources' using errcode = '23514';
  end if;
  if jsonb_array_length(p_images) > 3 then
    raise exception 'A story can have at most 3 photos' using errcode = '23514';
  end if;

  if v_id is null then
    insert into public.articles (title, dek, body_json, category, content_type)
    values (coalesce(p_title, ''), p_dek, coalesce(p_body_json, '{"type":"doc","content":[]}'::jsonb),
            p_category, coalesce(p_content_type, 'news'))
    returning id, status, slug into v_id, v_status, v_slug;
  else
    update public.articles set
      title = coalesce(p_title, ''),
      dek = p_dek,
      body_json = coalesce(p_body_json, '{"type":"doc","content":[]}'::jsonb),
      category = p_category,
      content_type = coalesce(p_content_type, 'news')
    where id = v_id
    returning status, slug into v_status, v_slug;
    if not found then
      raise exception 'This story can''t be edited' using errcode = 'P0002';
    end if;
  end if;

  -- Sources: replace in order.
  delete from public.article_sources where article_id = v_id;
  insert into public.article_sources (article_id, position, url, label)
  select v_id, (t.ord - 1)::smallint, t.x ->> 'url', nullif(btrim(t.x ->> 'label'), '')
  from jsonb_array_elements(p_sources) with ordinality as t(x, ord);

  -- Images: note files that are no longer used, then replace in order.
  select coalesce(array_agg(i.storage_path), '{}') into v_removed
  from public.article_images i
  where i.article_id = v_id
    and not exists (
      select 1 from jsonb_array_elements(p_images) x where x ->> 'storage_path' = i.storage_path
    );
  delete from public.article_images where article_id = v_id;
  insert into public.article_images (article_id, position, storage_path, alt_text, caption, credit)
  select v_id, (t.ord - 1)::smallint, t.x ->> 'storage_path',
         coalesce(btrim(t.x ->> 'alt_text'), ''),
         nullif(btrim(t.x ->> 'caption'), ''),
         nullif(btrim(t.x ->> 'credit'), '')
  from jsonb_array_elements(p_images) with ordinality as t(x, ord);

  return jsonb_build_object(
    'id', v_id,
    'status', v_status,
    'slug', v_slug,
    'removed_paths', to_jsonb(v_removed)
  );
end;
$$;

revoke execute on function public.save_article(uuid, text, text, jsonb, text, public.content_type, jsonb, jsonb)
  from public, anon;
grant execute on function public.save_article(uuid, text, text, jsonb, text, public.content_type, jsonb, jsonb)
  to authenticated, service_role;
