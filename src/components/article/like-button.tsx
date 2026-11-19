"use client";

import Link from "next/link";
import { Heart } from "lucide-react";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type State = { count: number; liked: boolean; canLike: boolean; signedIn: boolean };

export function likesLabel(count: number): string {
  return count === 1 ? "1 like" : `${count} likes`;
}

/**
 * Like toggle for a story. The article page is cached, so the count and the
 * reader's own state load here in the browser (article_engagement()).
 * Toggling is optimistic and rolls back on error.
 */
export function LikeButton({ articleId, slug }: { articleId: string; slug: string }) {
  const [state, setState] = useState<State | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    const supabase = createClient();
    void (async () => {
      const [{ data: session }, { data }] = await Promise.all([
        supabase.auth.getSession(),
        supabase.rpc("article_engagement", { p_article_id: articleId }),
      ]);
      const row = data?.[0];
      if (live && row) {
        setState({ count: row.like_count, liked: row.liked, canLike: row.can_like, signedIn: Boolean(session.session) });
      }
    })();
    return () => {
      live = false;
    };
  }, [articleId]);

  async function toggle() {
    if (!state || busy) return;
    const before = state;
    const liked = !before.liked;
    setBusy(true);
    setError(null);
    setState({ ...before, liked, count: before.count + (liked ? 1 : -1) });
    const supabase = createClient();
    const { error: err } = liked
      ? await supabase.from("reactions").insert({ article_id: articleId })
      : await supabase.from("reactions").delete().eq("article_id", articleId);
    if (err) {
      setState(before);
      setError("Your like couldn't be saved. Please try again.");
    }
    setBusy(false);
  }

  const count = state?.count ?? 0;
  const base = "inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-medium";

  return (
    <div className="flex flex-wrap items-center gap-3">
      {!state ? (
        <span className={cn(base, "border-border text-muted-foreground")} aria-hidden>
          <Heart className="size-4" /> Like
        </span>
      ) : !state.signedIn ? (
        <Link href={`/auth/sign-in?next=/a/${slug}`} className={cn(base, "border-border hover:bg-muted")}>
          <Heart className="size-4" aria-hidden /> Sign in to like
        </Link>
      ) : state.canLike || state.liked ? (
        <button
          type="button"
          onClick={toggle}
          disabled={busy}
          aria-pressed={state.liked}
          className={cn(
            base,
            state.liked ? "border-brand bg-brand/10 text-brand" : "border-border hover:bg-muted",
          )}
        >
          <Heart className={cn("size-4", state.liked && "fill-current")} aria-hidden />
          {state.liked ? "Liked" : "Like"}
        </button>
      ) : null}
      <span className="text-sm text-muted-foreground" aria-live="polite">
        {state ? likesLabel(count) : null}
      </span>
      {error ? (
        <p role="alert" className="w-full text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
