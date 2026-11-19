import type { SupabaseClient } from "@supabase/supabase-js";
import { getPublicEnv } from "@/lib/env";
import type { Database } from "@/lib/supabase/types";

type Client = SupabaseClient<Database>;
type ArticleRow = Database["public"]["Tables"]["articles"]["Row"];

export const ARTICLE_IMAGE_BUCKET = "article-images";

export type ArticleStatus = Database["public"]["Enums"]["article_status"];

export const STATUS_LABELS: Record<ArticleStatus, string> = {
  draft: "Draft",
  pending_review: "Waiting for review",
  published: "Published",
  hidden: "Hidden by moderators",
  archived: "Archived",
};

/** Public CDN URL for an article image path (bucket is public-read). */
export function articleImageUrl(path: string): string {
  return `${getPublicEnv().NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${ARTICLE_IMAGE_BUCKET}/${path}`;
}

export type EditableArticle = Pick<
  ArticleRow,
  | "id"
  | "author_id"
  | "slug"
  | "title"
  | "dek"
  | "body_json"
  | "category"
  | "content_type"
  | "status"
  | "submitted_at"
  | "published_at"
  | "updated_at"
> & {
  sources: { url: string; label: string | null }[];
  images: { storage_path: string; alt_text: string; caption: string | null; credit: string | null }[];
};

/** The caller's own story with its sources and images, or null. */
export async function getArticleForEdit(
  client: Client,
  id: string,
  userId: string,
): Promise<EditableArticle | null> {
  const { data, error } = await client
    .from("articles")
    .select(
      "id, author_id, slug, title, dek, body_json, category, content_type, status, submitted_at, published_at, updated_at, " +
        "article_sources (url, label, position), article_images (storage_path, alt_text, caption, credit, position)",
    )
    .eq("id", id)
    .eq("author_id", userId)
    .is("deleted_at", null)
    .maybeSingle<
      Omit<EditableArticle, "sources" | "images"> & {
        article_sources: { url: string; label: string | null; position: number }[];
        article_images: {
          storage_path: string;
          alt_text: string;
          caption: string | null;
          credit: string | null;
          position: number;
        }[];
      }
    >();
  if (error) throw error;
  if (!data) return null;
  const { article_sources, article_images, ...article } = data;
  return {
    ...article,
    sources: [...article_sources]
      .sort((a, b) => a.position - b.position)
      .map(({ url, label }) => ({ url, label })),
    images: [...article_images]
      .sort((a, b) => a.position - b.position)
      .map(({ storage_path, alt_text, caption, credit }) => ({ storage_path, alt_text, caption, credit })),
  };
}

export type MyArticleSummary = Pick<ArticleRow, "id" | "title" | "status" | "slug" | "updated_at">;

/** The caller's stories (newest edits first) for the Write page. */
export async function listMyArticles(client: Client, userId: string, limit = 50): Promise<MyArticleSummary[]> {
  const { data, error } = await client
    .from("articles")
    .select("id, title, status, slug, updated_at")
    .eq("author_id", userId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

export type SaveArticleResult = {
  id: string;
  status: ArticleStatus;
  slug: string | null;
  removed_paths: string[];
};
