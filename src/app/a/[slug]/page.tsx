import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticleView } from "@/components/article/article-view";
import { articleImageUrl, getPublishedArticle } from "@/lib/db/articles";
import { excerpt, richTextToPlain } from "@/lib/richtext";
import { createPublicClient } from "@/lib/supabase/public";

// Public, cached for 60s; saveArticle / addCorrection revalidate /a/<slug> after changes.
export const revalidate = 60;

// Build no stories ahead of time; render each on first visit, then cache (ISR).
export function generateStaticParams(): { slug: string }[] {
  return [];
}

type Props = { params: Promise<{ slug: string }> };

async function load(slug: string) {
  return getPublishedArticle(createPublicClient(), decodeURIComponent(slug));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const article = await load((await params).slug);
  if (!article) return { title: "Story not found" };
  const description = article.dek ?? excerpt(richTextToPlain(article.body_json), 160);
  const image = article.images[0];
  return {
    title: article.title,
    description,
    openGraph: {
      type: "article",
      title: article.title,
      description,
      publishedTime: article.published_at ?? undefined,
      modifiedTime: article.edited_at ?? undefined,
      images: image ? [{ url: articleImageUrl(image.storage_path), alt: image.alt_text }] : undefined,
    },
  };
}

export default async function ArticlePage({ params }: Props) {
  const article = await load((await params).slug);
  if (!article) notFound();
  return (
    <main>
      <ArticleView article={article} imageUrl={articleImageUrl} />
    </main>
  );
}
