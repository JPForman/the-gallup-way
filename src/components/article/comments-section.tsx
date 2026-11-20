"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useState, type FormEvent, type ReactNode } from "react";
import { Avatar } from "@/components/avatar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { listCommentThreads, type CommentRow, type CommentThread } from "@/lib/db/comments";
import { avatarUrl } from "@/lib/db/profiles";
import { SITE_TIMEZONE } from "@/lib/site";
import { createClient } from "@/lib/supabase/client";
import { COMMENT_MAX, commentBodySchema } from "@/lib/validation/comment";

const timeFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: SITE_TIMEZONE,
});

export function formatCommentTime(iso: string): string {
  return timeFmt.format(new Date(iso));
}

type Context = { count: number; locked: boolean; canComment: boolean; userId: string | null };

function postErrorMessage(code: string | undefined, message: string | undefined): string {
  if (code === "PT429" && message) return message;
  if (code === "42501") return "Your account can't comment right now.";
  return "Your comment couldn't be posted. Please try again.";
}

/** Text box + button used for new comments and replies. */
function Composer({
  label,
  submitLabel,
  onSubmit,
  onCancel,
  autoFocus,
}: {
  label: string;
  submitLabel: string;
  onSubmit: (body: string) => Promise<string | null>;
  onCancel?: () => void;
  autoFocus?: boolean;
}) {
  const id = useId();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = commentBodySchema.safeParse(body);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check your comment.");
      return;
    }
    setBusy(true);
    setError(null);
    const err = await onSubmit(parsed.data);
    setBusy(false);
    if (err) setError(err);
    else setBody("");
  }

  return (
    <form onSubmit={submit} className="space-y-2" noValidate>
      <Label htmlFor={id} className="text-sm font-semibold">
        {label}
      </Label>
      <Textarea
        id={id}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={COMMENT_MAX}
        autoFocus={autoFocus}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className="min-h-24 text-base"
      />
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button type="submit" disabled={busy} className="h-11 bg-brand text-brand-foreground hover:bg-brand/90">
          {busy ? "Posting…" : submitLabel}
        </Button>
        {onCancel ? (
          <Button type="button" variant="ghost" className="h-11" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}

function CommentBody({
  comment,
  mine,
  onDelete,
  children,
}: {
  comment: CommentRow;
  mine: boolean;
  onDelete: (id: number) => Promise<void>;
  children?: ReactNode;
}) {
  const [confirming, setConfirming] = useState(false);
  if (comment.deleted_at) {
    return (
      <p className="py-2 text-sm text-muted-foreground italic">
        {comment.removed_at ? "Removed by a moderator." : "Comment deleted."}
      </p>
    );
  }
  const name = comment.author?.display_name ?? "Former member";
  return (
    <div className="flex gap-3">
      <Avatar name={name} src={avatarUrl(comment.author?.avatar_path ?? null)} size={36} />
      <div className="min-w-0 flex-1">
        <p className="text-sm">
          {comment.author ? (
            <Link href={`/u/${comment.author.handle}`} className="font-semibold underline-offset-4 hover:underline">
              {name}
            </Link>
          ) : (
            <span className="font-semibold">{name}</span>
          )}{" "}
          <span className="text-muted-foreground">
            · <time dateTime={comment.created_at}>{formatCommentTime(comment.created_at)}</time>
          </span>
        </p>
        <p className="mt-1 break-words whitespace-pre-line">{comment.body}</p>
        <div className="mt-1 flex flex-wrap items-center gap-1">
          {children}
          {mine ? (
            confirming ? (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-11 px-3 text-destructive"
                  onClick={() => void onDelete(comment.id)}
                >
                  Yes, delete
                </Button>
                <Button type="button" variant="ghost" className="h-11 px-3" onClick={() => setConfirming(false)}>
                  Keep it
                </Button>
              </>
            ) : (
              <Button type="button" variant="ghost" className="h-11 px-3" onClick={() => setConfirming(true)}>
                Delete
              </Button>
            )
          ) : null}
        </div>
      </div>
    </div>
  );
}

/**
 * Comments under a story. The page is cached, so everything loads in the
 * browser and writes go straight to Supabase; the database enforces who may
 * comment (can_write(), published, not locked) and the daily limit.
 */
export function CommentsSection({ articleId, slug }: { articleId: string; slug: string }) {
  const [ctx, setCtx] = useState<Context | null>(null);
  const [threads, setThreads] = useState<CommentThread[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const [loadError, setLoadError] = useState(false);

  const refresh = useCallback(
    async (limit?: number) => {
      const supabase = createClient();
      try {
        const [{ data: session }, { data: context }, page] = await Promise.all([
          supabase.auth.getSession(),
          supabase.rpc("comments_context", { p_article_id: articleId }),
          listCommentThreads(supabase, articleId, limit ? { limit } : {}),
        ]);
        const row = context?.[0];
        setCtx({
          count: row?.comment_count ?? 0,
          locked: row?.locked ?? false,
          canComment: row?.can_comment ?? false,
          userId: session.session?.user.id ?? null,
        });
        setThreads(page.threads);
        setHasMore(page.hasMore);
        setLoadError(false);
      } catch {
        setLoadError(true);
      }
    },
    [articleId],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function loadMore() {
    const lastId = threads.at(-1)?.comment.id;
    const page = await listCommentThreads(createClient(), articleId, { afterId: lastId });
    setThreads((t) => [...t, ...page.threads]);
    setHasMore(page.hasMore);
  }

  async function post(body: string, parentId?: number): Promise<string | null> {
    const { error } = await createClient()
      .from("comments")
      .insert({ article_id: articleId, body, parent_id: parentId ?? null });
    if (error) return postErrorMessage(error.code, error.message);
    setReplyTo(null);
    await refresh(Math.max(threads.length + 1, 50));
    return null;
  }

  async function remove(id: number) {
    await createClient().rpc("delete_comment", { p_comment_id: id });
    await refresh(Math.max(threads.length, 50));
  }

  const userId = ctx?.userId ?? null;

  return (
    <section id="comments" aria-labelledby="comments-heading" className="border-t border-rule pt-6">
      <h2 id="comments-heading" className="font-serif text-xl font-semibold">
        Comments{ctx ? ` (${ctx.count})` : ""}
      </h2>

      <div className="mt-4">
        {!ctx ? (
          loadError ? (
            <p className="text-sm text-muted-foreground">Comments couldn&apos;t be loaded.</p>
          ) : (
            <p className="text-sm text-muted-foreground">Loading comments…</p>
          )
        ) : ctx.locked ? (
          <p className="rounded-md border border-border bg-muted p-3 text-sm">Comments are closed on this story.</p>
        ) : ctx.canComment ? (
          <Composer label="Add a comment" submitLabel="Post comment" onSubmit={(b) => post(b)} />
        ) : !ctx.userId ? (
          <p className="text-sm">
            <Link href={`/auth/sign-in?next=/a/${slug}`} className="font-medium underline underline-offset-4">
              Sign in to comment
            </Link>
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Your account can&apos;t comment right now. Check the notice at the top of the page.
          </p>
        )}
      </div>

      {ctx && threads.length === 0 && !ctx.locked ? (
        <p className="mt-6 text-sm text-muted-foreground">No comments yet.</p>
      ) : null}

      {threads.length ? (
        <ul className="mt-6 space-y-6">
          {threads.map(({ comment, replies }) => (
            <li key={comment.id}>
              <CommentBody comment={comment} mine={!!userId && comment.author_id === userId} onDelete={remove}>
                {ctx?.canComment && !comment.deleted_at ? (
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-11 px-3"
                    aria-expanded={replyTo === comment.id}
                    onClick={() => setReplyTo(replyTo === comment.id ? null : comment.id)}
                  >
                    Reply
                  </Button>
                ) : null}
              </CommentBody>

              {replies.length || replyTo === comment.id ? (
                <div className="mt-3 ml-6 space-y-4 border-l-2 border-border pl-4">
                  {replies.length ? (
                    <ul aria-label={`Replies to ${comment.author?.display_name ?? "comment"}`} className="space-y-4">
                      {replies.map((r) => (
                        <li key={r.id}>
                          <CommentBody comment={r} mine={!!userId && r.author_id === userId} onDelete={remove} />
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {replyTo === comment.id ? (
                    <Composer
                      label={`Reply to ${comment.author?.display_name ?? "this comment"}`}
                      submitLabel="Post reply"
                      onSubmit={(b) => post(b, comment.id)}
                      onCancel={() => setReplyTo(null)}
                      autoFocus
                    />
                  ) : null}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {hasMore ? (
        <div className="mt-6 text-center">
          <Button type="button" variant="outline" className="h-11" onClick={() => void loadMore()}>
            Show more comments
          </Button>
        </div>
      ) : null}
    </section>
  );
}
