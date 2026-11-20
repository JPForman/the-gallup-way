import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

type Client = SupabaseClient<Database>;

export type CommentRow = {
  id: number;
  parent_id: number | null;
  author_id: string | null;
  body: string;
  created_at: string;
  deleted_at: string | null;
  author: { handle: string; display_name: string; avatar_path: string | null } | null;
};

export type CommentThread = { comment: CommentRow; replies: CommentRow[] };

export const COMMENTS_PAGE_SIZE = 50;

const COLUMNS =
  "id, parent_id, author_id, body, created_at, deleted_at, author:profiles!comments_author_id_fkey (handle, display_name, avatar_path)";

/**
 * A story's comment threads, oldest first: up to `limit` top-level comments
 * (after the comment id `afterId`), each with its replies. Deleted comments
 * without replies are left out; with replies they stay as placeholders.
 * Ids are identity values, so they follow posting order.
 */
export async function listCommentThreads(
  client: Client,
  articleId: string,
  { afterId, limit = COMMENTS_PAGE_SIZE }: { afterId?: number; limit?: number } = {},
): Promise<{ threads: CommentThread[]; hasMore: boolean; lastId: number | null }> {
  let q = client
    .from("comments")
    .select(COLUMNS)
    .eq("article_id", articleId)
    .is("parent_id", null)
    .order("id", { ascending: true })
    .limit(limit + 1);
  if (afterId !== undefined) q = q.gt("id", afterId);
  const { data: top, error } = await q.returns<CommentRow[]>();
  if (error) throw error;

  const page = top.slice(0, limit);
  const ids = page.map((c) => c.id);
  let replies: CommentRow[] = [];
  if (ids.length) {
    const { data, error: replyError } = await client
      .from("comments")
      .select(COLUMNS)
      .in("parent_id", ids)
      .order("id", { ascending: true })
      .limit(500)
      .returns<CommentRow[]>();
    if (replyError) throw replyError;
    replies = data;
  }

  return { threads: buildThreads(page, replies), hasMore: top.length > limit, lastId: page.at(-1)?.id ?? null };
}

/**
 * Group replies under their comment. Deleted replies are dropped; a deleted
 * top-level comment stays (as a placeholder) only if it still has replies.
 */
export function buildThreads(top: CommentRow[], replies: CommentRow[]): CommentThread[] {
  return top
    .map((comment) => ({
      comment,
      replies: replies.filter((r) => r.parent_id === comment.id && !r.deleted_at),
    }))
    .filter((t) => !t.comment.deleted_at || t.replies.length > 0);
}
