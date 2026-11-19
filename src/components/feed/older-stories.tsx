import Link from "next/link";
import { StoryGrid } from "@/components/feed/story-card";
import { articleImageUrl, type FeedItem } from "@/lib/db/articles";
import { encodeCursor, type FeedCursor } from "@/lib/feed/cursor";

const BUTTON =
  "inline-flex min-h-11 items-center rounded-md border border-border px-5 font-medium hover:bg-muted";

/** An older page of a feed (/latest/[cursor], /c/[slug]/[cursor]). */
export function OlderStories({
  title,
  items,
  next,
  basePath,
  backHref,
  backLabel,
}: {
  title: string;
  items: FeedItem[];
  next: FeedCursor | null;
  /** Older pages live at `${basePath}/<cursor>`. */
  basePath: string;
  backHref: string;
  backLabel: string;
}) {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="font-serif text-3xl font-bold tracking-tight">{title}</h1>
      {items.length ? (
        <div className="mt-6">
          <StoryGrid items={items} imageUrl={articleImageUrl} />
        </div>
      ) : (
        <p className="mt-6 text-muted-foreground">You&apos;ve reached the end. There are no older stories.</p>
      )}
      <nav aria-label="Pages" className="mt-8 flex flex-wrap justify-center gap-3 border-t border-rule pt-6">
        <Link href={backHref} className={BUTTON}>
          {backLabel}
        </Link>
        {next ? (
          <Link href={`${basePath}/${encodeCursor(next)}`} className={BUTTON}>
            Older stories
          </Link>
        ) : null}
      </nav>
    </main>
  );
}
