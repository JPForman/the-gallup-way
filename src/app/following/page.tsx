import type { Metadata } from "next";
import Link from "next/link";
import { FeedTabs } from "@/components/feed/feed-tabs";
import { StoryGrid } from "@/components/feed/story-card";
import { articleImageUrl, listFollowingArticles } from "@/lib/db/articles";
import { decodeCursor, encodeCursor } from "@/lib/feed/cursor";
import { createClient } from "@/lib/supabase/server";

// Per reader, so dynamic (cookie-based client); never cached across users.
export const metadata: Metadata = { title: "Following", robots: { index: false, follow: false } };

const BUTTON =
  "inline-flex min-h-11 items-center rounded-md border border-border px-5 font-medium hover:bg-muted";

export default async function FollowingPage({
  searchParams,
}: {
  searchParams: Promise<{ before?: string }>;
}) {
  const { before: rawBefore } = await searchParams;
  const before = rawBefore ? decodeCursor(rawBefore) : null;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="sr-only">Stories from people you follow</h1>
      <FeedTabs current="following" />
      {!data.user ? (
        <section className="rounded-md border border-dashed border-border p-8 text-center">
          <p className="font-serif text-2xl font-semibold">Follow the writers you like.</p>
          <p className="mt-2 text-muted-foreground">
            <Link href="/auth/sign-in?next=/following" className="underline underline-offset-4">
              Sign in
            </Link>{" "}
            to see their newest stories here.
          </p>
        </section>
      ) : (
        <FollowingFeed supabase={supabase} before={before ?? undefined} />
      )}
    </main>
  );
}

async function FollowingFeed({
  supabase,
  before,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  before?: { publishedAt: string; id: string };
}) {
  const { items, next } = await listFollowingArticles(supabase, { before });
  if (!items.length) {
    return (
      <section className="rounded-md border border-dashed border-border p-8 text-center">
        <p className="font-serif text-2xl font-semibold">{before ? "That's everything." : "Nothing here yet."}</p>
        <p className="mt-2 text-muted-foreground">
          {before ? (
            <Link href="/following" className="underline underline-offset-4">
              Back to the newest stories
            </Link>
          ) : (
            "Follow writers from their profile or story pages, and their new stories will show up here."
          )}
        </p>
      </section>
    );
  }
  return (
    <>
      <section aria-label="Stories from people you follow">
        <StoryGrid items={items} imageUrl={articleImageUrl} />
      </section>
      {next || before ? (
        <nav aria-label="Pages" className="mt-8 flex flex-wrap justify-center gap-3 border-t border-rule pt-6">
          {before ? (
            <Link href="/following" className={BUTTON}>
              Newest
            </Link>
          ) : null}
          {next ? (
            <Link href={`/following?before=${encodeCursor(next)}`} className={BUTTON}>
              Older stories
            </Link>
          ) : null}
        </nav>
      ) : null}
    </>
  );
}
