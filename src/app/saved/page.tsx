import type { Metadata } from "next";
import Link from "next/link";
import { StoryGrid } from "@/components/feed/story-card";
import { articleImageUrl, listSavedArticles } from "@/lib/db/articles";
import { decodeCursor, encodeCursor } from "@/lib/feed/cursor";
import { createClient } from "@/lib/supabase/server";

// Private per reader: dynamic (cookie-based client), never indexed.
export const metadata: Metadata = { title: "Saved stories", robots: { index: false, follow: false } };

const BUTTON =
  "inline-flex min-h-11 items-center rounded-md border border-border px-5 font-medium hover:bg-muted";

export default async function SavedPage({ searchParams }: { searchParams: Promise<{ before?: string }> }) {
  const { before: rawBefore } = await searchParams;
  const before = (rawBefore ? decodeCursor(rawBefore) : null) ?? undefined;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="font-serif text-3xl font-semibold">Saved stories</h1>
        <section className="mt-6 rounded-md border border-dashed border-border p-8 text-center">
          <p className="font-serif text-2xl font-semibold">Keep stories for later.</p>
          <p className="mt-2 text-muted-foreground">
            <Link href="/auth/sign-in?next=/saved" className="underline underline-offset-4">
              Sign in
            </Link>{" "}
            and tap Save on any story to find it here.
          </p>
        </section>
      </main>
    );
  }

  const { items, next } = await listSavedArticles(supabase, { before });

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="font-serif text-3xl font-semibold">Saved stories</h1>
      <p className="mt-1 text-sm text-muted-foreground">Only you can see what you save.</p>
      {!items.length ? (
        <section className="mt-6 rounded-md border border-dashed border-border p-8 text-center">
          <p className="font-serif text-2xl font-semibold">{before ? "That's everything." : "Nothing saved yet."}</p>
          <p className="mt-2 text-muted-foreground">
            {before ? (
              <Link href="/saved" className="underline underline-offset-4">
                Back to your most recent saves
              </Link>
            ) : (
              "Tap Save on any story to keep it here."
            )}
          </p>
        </section>
      ) : (
        <>
          <section aria-label="Your saved stories" className="mt-6">
            <StoryGrid items={items} imageUrl={articleImageUrl} />
          </section>
          {next || before ? (
            <nav aria-label="Pages" className="mt-8 flex flex-wrap justify-center gap-3 border-t border-rule pt-6">
              {before ? (
                <Link href="/saved" className={BUTTON}>
                  Most recent
                </Link>
              ) : null}
              {next ? (
                <Link href={`/saved?before=${encodeCursor(next)}`} className={BUTTON}>
                  Older saves
                </Link>
              ) : null}
            </nav>
          ) : null}
        </>
      )}
    </main>
  );
}
