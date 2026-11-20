"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { hasPublicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type State = { followers: number; following: number; isFollowing: boolean; canFollow: boolean; signedIn: boolean; self: boolean };

export function followerLabel(n: number): string {
  return n === 1 ? "1 follower" : `${n} followers`;
}

/**
 * Follow / Following toggle for a writer, loaded in the browser (pages are
 * cached). Counts are public; who follows whom is private (see follows migration).
 * `showCounts` adds "N followers · N following" (profile pages).
 */
export function FollowButton({
  profileId,
  name,
  signInNext,
  showCounts = false,
}: {
  profileId: string;
  name: string;
  /** Where to come back to after signing in. */
  signInNext: string;
  showCounts?: boolean;
}) {
  const [state, setState] = useState<State | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasPublicEnv()) return;
    let live = true;
    const supabase = createClient();
    void (async () => {
      const [{ data: session }, { data }] = await Promise.all([
        supabase.auth.getSession(),
        supabase.rpc("follow_context", { p_profile_id: profileId }),
      ]);
      const row = data?.[0];
      const uid = session.session?.user.id ?? null;
      if (live && row) {
        setState({
          followers: row.followers,
          following: row.following,
          isFollowing: row.is_following,
          canFollow: row.can_follow,
          signedIn: uid !== null,
          self: uid === profileId,
        });
      }
    })();
    return () => {
      live = false;
    };
  }, [profileId]);

  async function toggle() {
    if (!state || busy) return;
    const before = state;
    const isFollowing = !before.isFollowing;
    setBusy(true);
    setError(null);
    setState({ ...before, isFollowing, followers: before.followers + (isFollowing ? 1 : -1) });
    const supabase = createClient();
    const { error: err } = isFollowing
      ? await supabase.from("follows").insert({ followee_id: profileId })
      : await supabase.from("follows").delete().eq("followee_id", profileId);
    if (err) {
      setState(before);
      setError(err.code === "PT429" ? err.message : "That didn't work. Please try again.");
    }
    setBusy(false);
  }

  const base = "inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-medium";
  let control: ReactNode = null;
  if (state && !state.self) {
    if (!state.signedIn) {
      control = (
        <Link href={`/auth/sign-in?next=${encodeURIComponent(signInNext)}`} className={cn(base, "border-border hover:bg-muted")}>
          Sign in to follow
        </Link>
      );
    } else if (state.canFollow || state.isFollowing) {
      control = (
        <button
          type="button"
          onClick={toggle}
          disabled={busy}
          aria-pressed={state.isFollowing}
          aria-label={state.isFollowing ? `Following ${name}` : `Follow ${name}`}
          className={cn(
            base,
            state.isFollowing ? "border-brand bg-brand/10 text-brand" : "border-foreground bg-foreground text-background hover:opacity-90",
          )}
        >
          {state.isFollowing ? "Following" : "Follow"}
        </button>
      );
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {control}
      {showCounts && state ? (
        <span className="text-sm text-muted-foreground" aria-live="polite">
          {followerLabel(state.followers)} · {state.following} following
        </span>
      ) : null}
      {error ? (
        <p role="alert" className="w-full text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
