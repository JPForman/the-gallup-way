import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StoryGrid } from "@/components/feed/story-card";
import { articleImageUrl, listLatestArticles } from "@/lib/db/articles";
import { decodeCursor, encodeCursor } from "@/lib/feed/cursor";
import { createPublicClient } from "@/lib/supabase/public";

// Older pages of the Latest feed. Each cursor is its own cached page (ISR),
// so paging needs no JavaScript and costs no function call once cached.
export const revalidate = 60;

export function generateStaticParams(): { cursor: string }[] {
  return [];
}

export const metadata: Metadata = { title: "More stories", robots: { index: false, follow: true } };

export default async function LatestPage({ params }: { params: Promise<{ cursor: string }> }) {
  const before = decodeCursor((await params).cursor);
  if (!before) notFound();
  const { items, next } = await listLatestArticles(createPublicClient(), { before });

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="font-serif text-3xl font-bold tracking-tight">More stories</h1>
      {items.length ? (
        <div className="mt-6">
          <StoryGrid items={items} imageUrl={articleImageUrl} />
        </div>
      ) : (
        <p className="mt-6 text-muted-foreground">You&apos;ve reached the end. There are no older stories.</p>
      )}
      <nav aria-label="Pages" className="mt-8 flex flex-wrap justify-center gap-3 border-t border-rule pt-6">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center rounded-md border border-border px-5 font-medium hover:bg-muted"
        >
          Front page
        </Link>
        {next ? (
          <Link
            href={`/latest/${encodeCursor(next)}`}
            className="inline-flex min-h-11 items-center rounded-md border border-border px-5 font-medium hover:bg-muted"
          >
            Older stories
          </Link>
        ) : null}
      </nav>
    </main>
  );
}
