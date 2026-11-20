"use client";

import Link from "next/link";
import { Bookmark } from "lucide-react";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type State = { saved: boolean; signedIn: boolean };

/**
 * Save / Saved toggle for a story. Bookmarks are private, so there's no
 * count; the reader's own state loads in the browser (the page is cached).
 */
export function SaveButton({ articleId, slug }: { articleId: string; slug: string }) {
  const [state, setState] = useState<State | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    const supabase = createClient();
    void (async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        if (live) setState({ saved: false, signedIn: false });
        return;
      }
      const { data } = await supabase.from("bookmarks").select("article_id").eq("article_id", articleId).maybeSingle();
      if (live) setState({ saved: Boolean(data), signedIn: true });
    })();
    return () => {
      live = false;
    };
  }, [articleId]);

  async function toggle() {
    if (!state || busy) return;
    const before = state;
    const saved = !before.saved;
    setBusy(true);
    setError(null);
    setState({ ...before, saved });
    const supabase = createClient();
    const { error: err } = saved
      ? await supabase.from("bookmarks").insert({ article_id: articleId })
      : await supabase.from("bookmarks").delete().eq("article_id", articleId);
    if (err) {
      setState(before);
      setError(err.code === "PT429" ? err.message : "That didn't work. Please try again.");
    }
    setBusy(false);
  }

  const base = "inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-medium";

  return (
    <div className="flex flex-wrap items-center gap-3">
      {!state ? (
        <span className={cn(base, "border-border text-muted-foreground")} aria-hidden>
          <Bookmark className="size-4" /> Save
        </span>
      ) : !state.signedIn ? (
        <Link href={`/auth/sign-in?next=/a/${slug}`} className={cn(base, "border-border hover:bg-muted")}>
          <Bookmark className="size-4" aria-hidden /> Sign in to save
        </Link>
      ) : (
        <button
          type="button"
          onClick={toggle}
          disabled={busy}
          aria-pressed={state.saved}
          className={cn(base, state.saved ? "border-brand bg-brand/10 text-brand" : "border-border hover:bg-muted")}
        >
          <Bookmark className={cn("size-4", state.saved && "fill-current")} aria-hidden />
          {state.saved ? "Saved" : "Save"}
        </button>
      )}
      {error ? (
        <p role="alert" className="w-full text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
