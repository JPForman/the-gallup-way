/** Matches the 100-character cap in search_articles() / search_profiles(). */
export const SEARCH_MAX_LENGTH = 100;
/** search_articles() caps the offset at 500: 25 pages of 20. */
export const SEARCH_MAX_PAGE = 25;

export type SearchTab = "stories" | "writers";
export type SearchParams = { q: string; tab: SearchTab; page: number };

function first(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

/** Normalize /search?q=&tab=&page= (anything unexpected falls back to defaults). */
export function parseSearchParams(raw: Record<string, string | string[] | undefined>): SearchParams {
  const q = first(raw.q).replace(/\s+/g, " ").trim().slice(0, SEARCH_MAX_LENGTH);
  const tab: SearchTab = first(raw.tab) === "writers" ? "writers" : "stories";
  const n = Number.parseInt(first(raw.page), 10);
  const page = Number.isFinite(n) ? Math.min(Math.max(n, 1), SEARCH_MAX_PAGE) : 1;
  return { q, tab, page };
}

/** URL for a search state; omits defaults so links stay short. */
export function searchHref({ q, tab, page }: Partial<SearchParams>): string {
  const p = new URLSearchParams();
  if (q) p.set("q", q);
  if (tab && tab !== "stories") p.set("tab", tab);
  if (page && page > 1) p.set("page", String(page));
  const s = p.toString();
  return s ? `/search?${s}` : "/search";
}
