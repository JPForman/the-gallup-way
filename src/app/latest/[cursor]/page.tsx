import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OlderStories } from "@/components/feed/older-stories";
import { listLatestArticles } from "@/lib/db/articles";
import { decodeCursor } from "@/lib/feed/cursor";
import { createPublicClient } from "@/lib/supabase/public";

// Older pages of the Latest feed. Each cursor is its own cached page (ISR),
// so paging needs no JavaScript and costs no function call once cached.
export const revalidate = 60;

export function generateStaticParams(): { cursor: string }[] {
  return [];
}

export const metadata: Metadata = { title: "More stories", robots: { index: false, follow: true } };

export default async function LatestOlderPage({ params }: { params: Promise<{ cursor: string }> }) {
  const before = decodeCursor((await params).cursor);
  if (!before) notFound();
  const { items, next } = await listLatestArticles(createPublicClient(), { before });
  return (
    <OlderStories
      title="More stories"
      items={items}
      next={next}
      basePath="/latest"
      backHref="/latest"
      backLabel="Latest stories"
    />
  );
}
