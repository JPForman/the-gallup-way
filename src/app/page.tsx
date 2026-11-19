import { Suspense } from "react";
import { FeedTabs } from "@/components/feed/feed-tabs";
import { FrontPage } from "@/components/feed/front-page";
import { WelcomeBanner } from "@/components/welcome-banner";
import { listLatestArticles, listTopArticles } from "@/lib/db/articles";
import { SITE_NAME } from "@/lib/site";
import { createPublicClient } from "@/lib/supabase/public";

// Cached for 60s (scores move with views); publishing and edits revalidate "/".
export const revalidate = 60;

export default async function HomePage() {
  const client = createPublicClient();
  let items = await listTopArticles(client);
  // A quiet week (nothing published in 7 days): show the newest stories instead.
  const quiet = items.length === 0;
  if (quiet) items = (await listLatestArticles(client)).items;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="sr-only">{SITE_NAME}: top stories</h1>
      <Suspense>
        <WelcomeBanner />
      </Suspense>
      <FeedTabs current="top" />
      <FrontPage
        items={items}
        gridLabel="More top stories"
        note={quiet && items.length ? "Nothing new this week. Here are the most recent stories." : undefined}
        more={items.length ? "/latest" : null}
      />
    </main>
  );
}
