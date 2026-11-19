import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FrontPage } from "@/components/feed/front-page";
import { categoryBySlug } from "@/lib/categories";
import { listLatestArticles } from "@/lib/db/articles";
import { encodeCursor } from "@/lib/feed/cursor";
import { CATEGORIES } from "@/lib/site";
import { createPublicClient } from "@/lib/supabase/public";

// Cached for 60s; publishing and edits revalidate /c/<category>.
export const revalidate = 60;

// The 8 categories are fixed: build them all; unknown slugs 404 below.
// (Don't set dynamicParams = false: revalidatePath then doesn't refresh these pages.)
export function generateStaticParams(): { slug: string }[] {
  return CATEGORIES.map((c) => ({ slug: c.slug }));
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const category = categoryBySlug((await params).slug);
  return category
    ? { title: category.name, description: `${category.name} stories posted by Gallup community members.` }
    : {};
}

export default async function CategoryPage({ params }: Props) {
  const slug = (await params).slug;
  const category = categoryBySlug(slug);
  if (!category) notFound();
  const { items, next } = await listLatestArticles(createPublicClient(), { category: slug });

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-6 border-b border-rule pb-3 font-serif text-3xl font-bold tracking-tight">{category.name}</h1>
      {items.length ? (
        <FrontPage
          items={items}
          gridLabel={`More ${category.name.toLowerCase()} stories`}
          more={next ? `/c/${slug}/${encodeCursor(next)}` : null}
        />
      ) : (
        <p className="text-muted-foreground">No {category.name.toLowerCase()} stories yet.</p>
      )}
    </main>
  );
}
