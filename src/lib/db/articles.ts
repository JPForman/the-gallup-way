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

/** Slugs are frozen at submission: `<slugified title>-<6 hex>` (see submit_article). */
export const ARTICLE_SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export type PublicArticle = Pick<
  ArticleRow,
  "id" | "author_id" | "slug" | "title" | "dek" | "body_json" | "category" | "content_type" | "published_at" | "edited_at"
> & {
  /** Null after the author deleted their account and kept their stories. */
  author: { handle: string; display_name: string; avatar_path: string | null } | null;
  sources: { url: string; label: string | null }[];
  images: { storage_path: string; alt_text: string; caption: string | null; credit: string | null }[];
  corrections: { id: number; body: string; created_at: string }[];
};

type PublicArticleRow = Omit<PublicArticle, "sources" | "images" | "corrections"> & {
  article_sources: { url: string; label: string | null; position: number }[];
  article_images: {
    storage_path: string;
    alt_text: string;
    caption: string | null;
    credit: string | null;
    position: number;
  }[];
  corrections: { id: number; body: string; created_at: string }[];
};

/**
 * A published, not-deleted story by slug, or null. Use with the public
 * (anon) client, so RLS returns only what everyone may see.
 */
export async function getPublishedArticle(client: Client, slug: string): Promise<PublicArticle | null> {
  if (!ARTICLE_SLUG_PATTERN.test(slug) || slug.length > 100) return null;
  const { data, error } = await client
    .from("articles")
    .select(
      "id, author_id, slug, title, dek, body_json, category, content_type, published_at, edited_at, " +
        "author:profiles!articles_author_id_fkey (handle, display_name, avatar_path), " +
        "article_sources (url, label, position), " +
        "article_images (storage_path, alt_text, caption, credit, position), " +
        "corrections (id, body, created_at)",
    )
    .eq("slug", slug)
    .eq("status", "published")
    .is("deleted_at", null)
    .maybeSingle<PublicArticleRow>();
  if (error) throw error;
  if (!data) return null;
  const { article_sources, article_images, corrections, ...article } = data;
  return {
    ...article,
    sources: [...article_sources]
      .sort((a, b) => a.position - b.position)
      .map(({ url, label }) => ({ url, label })),
    images: [...article_images]
      .sort((a, b) => a.position - b.position)
      .map(({ storage_path, alt_text, caption, credit }) => ({ storage_path, alt_text, caption, credit })),
    corrections: [...corrections].sort((a, b) => a.created_at.localeCompare(b.created_at)),
  };
}

/** One story in a feed (from feed_latest()). */
export type FeedItem = {
  id: string;
  slug: string;
  title: string;
  dek: string | null;
  excerpt: string;
  category: string | null;
  content_type: Database["public"]["Enums"]["content_type"];
  published_at: string;
  author_handle: string | null;
  author_display_name: string | null;
  image_path: string | null;
  image_alt: string | null;
};

export const FEED_PAGE_SIZE = 20;

/**
 * A page of the Latest feed, newest first. `next` is the cursor for the
 * following page, or null on the last page.
 */
export async function listLatestArticles(
  client: Client,
  opts: { before?: { publishedAt: string; id: string }; category?: string } = {},
): Promise<{ items: FeedItem[]; next: { publishedAt: string; id: string } | null }> {
  const { data, error } = await client.rpc("feed_latest", {
    p_before_published_at: opts.before?.publishedAt,
    p_before_id: opts.before?.id,
    p_category: opts.category,
    p_limit: FEED_PAGE_SIZE + 1,
  });
  if (error) throw error;
  const rows = (data ?? []) as unknown as FeedItem[];
  const items = rows.slice(0, FEED_PAGE_SIZE);
  const last = items.at(-1);
  return {
    items,
    next: rows.length > FEED_PAGE_SIZE && last ? { publishedAt: last.published_at, id: last.id } : null,
  };
}

/** Top Stories (top_stories()): last 7 days, best score first. Same shape as the Latest feed. */
export async function listTopArticles(client: Client, limit = FEED_PAGE_SIZE): Promise<FeedItem[]> {
  const { data, error } = await client.rpc("top_stories", { p_limit: limit });
  if (error) throw error;
  return (data ?? []) as unknown as FeedItem[];
}

export const SEARCH_PAGE_SIZE = 20;

/** Full-text story search (search_articles()), best match first. */
export async function searchArticles(
  client: Client,
  query: string,
  page = 1,
): Promise<{ items: FeedItem[]; hasMore: boolean }> {
  const { data, error } = await client.rpc("search_articles", {
    p_query: query,
    p_limit: SEARCH_PAGE_SIZE + 1,
    p_offset: (page - 1) * SEARCH_PAGE_SIZE,
  });
  if (error) throw error;
  const rows = (data ?? []) as unknown as FeedItem[];
  return { items: rows.slice(0, SEARCH_PAGE_SIZE), hasMore: rows.length > SEARCH_PAGE_SIZE };
}

/** A page of the signed-in reader's Following feed (feed_following()); empty when signed out. */
export async function listFollowingArticles(
  client: Client,
  opts: { before?: { publishedAt: string; id: string } } = {},
): Promise<{ items: FeedItem[]; next: { publishedAt: string; id: string } | null }> {
  const { data, error } = await client.rpc("feed_following", {
    p_before_published_at: opts.before?.publishedAt,
    p_before_id: opts.before?.id,
    p_limit: FEED_PAGE_SIZE + 1,
  });
  if (error) throw error;
  const rows = (data ?? []) as unknown as FeedItem[];
  const items = rows.slice(0, FEED_PAGE_SIZE);
  const last = items.at(-1);
  return {
    items,
    next: rows.length > FEED_PAGE_SIZE && last ? { publishedAt: last.published_at, id: last.id } : null,
  };
}

/** A saved story: a feed item plus when the reader saved it. */
export type SavedItem = FeedItem & { saved_at: string };

/**
 * The signed-in reader's saved stories, most recently saved first. The cursor
 * reuses FeedCursor, with `publishedAt` holding the saved_at time.
 */
export async function listSavedArticles(
  client: Client,
  opts: { before?: { publishedAt: string; id: string } } = {},
): Promise<{ items: SavedItem[]; next: { publishedAt: string; id: string } | null }> {
  const { data, error } = await client.rpc("saved_articles", {
    p_before_saved_at: opts.before?.publishedAt,
    p_before_id: opts.before?.id,
    p_limit: FEED_PAGE_SIZE + 1,
  });
  if (error) throw error;
  const rows = (data ?? []) as unknown as SavedItem[];
  const items = rows.slice(0, FEED_PAGE_SIZE);
  const last = items.at(-1);
  return {
    items,
    next: rows.length > FEED_PAGE_SIZE && last ? { publishedAt: last.saved_at, id: last.id } : null,
  };
}
