import { CATEGORIES } from "@/lib/site";

export type Category = (typeof CATEGORIES)[number];

/** The category for a URL slug, or null for unknown slugs. */
export function categoryBySlug(slug: string): Category | null {
  return CATEGORIES.find((c) => c.slug === slug) ?? null;
}
