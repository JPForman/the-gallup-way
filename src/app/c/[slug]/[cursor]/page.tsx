import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OlderStories } from "@/components/feed/older-stories";
import { categoryBySlug } from "@/lib/categories";
import { listLatestArticles } from "@/lib/db/articles";
import { decodeCursor } from "@/lib/feed/cursor";
import { createPublicClient } from "@/lib/supabase/public";

// Older pages of a category, one cached page per cursor (ISR).
export const revalidate = 60;

export function generateStaticParams(): { slug: string; cursor: string }[] {
  return [];
}

export const metadata: Metadata = { title: "More stories", robots: { index: false, follow: true } };

export default async function CategoryOlderPage({ params }: { params: Promise<{ slug: string; cursor: string }> }) {
  const { slug, cursor } = await params;
  const category = categoryBySlug(slug);
  const before = decodeCursor(cursor);
  if (!category || !before) notFound();
  const { items, next } = await listLatestArticles(createPublicClient(), { category: slug, before });
  return (
    <OlderStories
      title={`More ${category.name.toLowerCase()} stories`}
      items={items}
      next={next}
      basePath={`/c/${slug}`}
      backHref={`/c/${slug}`}
      backLabel={category.name}
    />
  );
}
