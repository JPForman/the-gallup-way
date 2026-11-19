import Link from "next/link";
import type { ReactNode } from "react";
import { StoryCard, StoryGrid } from "@/components/feed/story-card";
import { articleImageUrl, type FeedItem } from "@/lib/db/articles";

/** Lead story + grid, shared by Top (/) and Latest (/latest). */
export function FrontPage({
  items,
  gridLabel,
  note,
  more,
}: {
  items: FeedItem[];
  gridLabel: string;
  note?: ReactNode;
  more?: string | null;
}) {
  const [lead, ...rest] = items;
  if (!lead) {
    return (
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
    );
  }
  return (
    <>
      {note ? <p className="mb-6 text-sm text-muted-foreground">{note}</p> : null}
      <section aria-label="Lead story">
        <StoryCard item={lead} imageUrl={articleImageUrl} lead />
      </section>
      {rest.length ? (
        <section aria-label={gridLabel} className="mt-10">
          <StoryGrid items={rest} imageUrl={articleImageUrl} />
        </section>
      ) : null}
      {more ? (
        <p className="mt-8 border-t border-rule pt-6 text-center">
          <Link
            href={more}
            className="inline-flex min-h-11 items-center rounded-md border border-border px-5 font-medium hover:bg-muted"
          >
            More stories
          </Link>
        </p>
      ) : null}
    </>
  );
}
