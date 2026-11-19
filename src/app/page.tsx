import Link from "next/link";
import { Suspense } from "react";
import { StoryCard, StoryGrid } from "@/components/feed/story-card";
import { WelcomeBanner } from "@/components/welcome-banner";
import { articleImageUrl, listLatestArticles } from "@/lib/db/articles";
import { encodeCursor } from "@/lib/feed/cursor";
import { SITE_NAME } from "@/lib/site";
import { createPublicClient } from "@/lib/supabase/public";

// Cached for 60s; publishing and editing a published story revalidate "/".
export const revalidate = 60;

export default async function HomePage() {
  const { items, next } = await listLatestArticles(createPublicClient());
  const [lead, ...rest] = items;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="sr-only">{SITE_NAME}: latest stories</h1>
      <Suspense>
        <WelcomeBanner />
      </Suspense>

      {lead ? (
        <>
          <section aria-label="Top story">
            <StoryCard item={lead} imageUrl={articleImageUrl} lead />
          </section>
          {rest.length ? (
            <section aria-labelledby="latest-heading" className="mt-10">
              <h2 id="latest-heading" className="mb-2 text-xs font-bold tracking-widest uppercase">
                Latest
              </h2>
              <StoryGrid items={rest} imageUrl={articleImageUrl} />
            </section>
          ) : null}
          {next ? (
            <p className="mt-8 border-t border-rule pt-6 text-center">
              <Link
                href={`/latest/${encodeCursor(next)}`}
                className="inline-flex min-h-11 items-center rounded-md border border-border px-5 font-medium hover:bg-muted"
              >
                More stories
              </Link>
            </p>
          ) : null}
        </>
      ) : (
        <section className="rounded-md border border-dashed border-border p-8 text-center">
          <p className="font-serif text-2xl font-semibold">No stories yet.</p>
          <p className="mt-2 text-muted-foreground">
            This board is written by people who live here.{" "}
            <Link href="/write" className="underline underline-offset-4">
              Share the first story
            </Link>
            .
          </p>
        </section>
      )}
    </main>
  );
}
