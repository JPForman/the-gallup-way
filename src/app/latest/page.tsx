import type { Metadata } from "next";
import { FeedTabs } from "@/components/feed/feed-tabs";
import { FrontPage } from "@/components/feed/front-page";
import { listLatestArticles } from "@/lib/db/articles";
import { encodeCursor } from "@/lib/feed/cursor";
import { createPublicClient } from "@/lib/supabase/public";

// Cached for 60s; publishing and edits revalidate "/latest".
export const revalidate = 60;

export const metadata: Metadata = { title: "Latest stories" };

export default async function LatestFirstPage() {
  const { items, next } = await listLatestArticles(createPublicClient());
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="sr-only">Latest stories</h1>
      <FeedTabs current="latest" />
      <FrontPage items={items} gridLabel="Latest" more={next ? `/latest/${encodeCursor(next)}` : null} />
    </main>
  );
}
