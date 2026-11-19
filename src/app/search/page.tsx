import type { Metadata } from "next";
import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { StoryCard } from "@/components/feed/story-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { articleImageUrl, searchArticles } from "@/lib/db/articles";
import { avatarUrl, searchWriters } from "@/lib/db/profiles";
import { parseSearchParams, SEARCH_MAX_LENGTH, SEARCH_MAX_PAGE, searchHref, type SearchTab } from "@/lib/search/params";
import { createPublicClient } from "@/lib/supabase/public";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Search", robots: { index: false, follow: true } };

const TABS: { key: SearchTab; label: string }[] = [
  { key: "stories", label: "Stories" },
  { key: "writers", label: "Writers" },
];

const BUTTON =
  "inline-flex min-h-11 items-center rounded-md border border-border px-5 font-medium hover:bg-muted";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { q, tab, page } = parseSearchParams(await searchParams);
  const client = createPublicClient();

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 md:py-12">
      <h1 className="font-serif text-3xl font-bold tracking-tight">Search</h1>

      {/* Plain GET form: works without JavaScript, and results have shareable URLs. */}
      <form action="/search" method="get" role="search" className="mt-6 flex gap-2">
        <label htmlFor="search-q" className="sr-only">
          Search stories and writers
        </label>
        <Input
          id="search-q"
          name="q"
          type="search"
          defaultValue={q}
          maxLength={SEARCH_MAX_LENGTH}
          placeholder="Search stories and writers"
          className="h-11 text-base"
          autoComplete="off"
        />
        {tab !== "stories" ? <input type="hidden" name="tab" value={tab} /> : null}
        <Button type="submit" className="h-11 bg-brand px-5 text-brand-foreground hover:bg-brand/90">
          Search
        </Button>
      </form>

      {q ? (
        <>
          <nav aria-label="Result types" className="mt-6 border-b border-rule">
            <ul className="flex gap-1">
              {TABS.map((t) => (
                <li key={t.key}>
                  <Link
                    href={searchHref({ q, tab: t.key })}
                    aria-current={t.key === tab ? "page" : undefined}
                    className={cn(
                      "-mb-px inline-flex min-h-11 items-center border-b-2 px-4 text-sm font-semibold tracking-wide uppercase",
                      t.key === tab
                        ? "border-brand text-foreground"
                        : "border-transparent text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {t.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          {tab === "stories" ? <StoryResults client={client} q={q} page={page} /> : <WriterResults client={client} q={q} />}
        </>
      ) : (
        <p className="mt-6 text-muted-foreground">
          Search headlines, summaries and stories, or find a writer by name. Use quotes for an exact phrase, like
          &ldquo;farmers market&rdquo;.
        </p>
      )}
    </main>
  );
}

type Client = ReturnType<typeof createPublicClient>;

async function StoryResults({ client, q, page }: { client: Client; q: string; page: number }) {
  const { items, hasMore } = await searchArticles(client, q, page);
  if (!items.length) {
    return (
      <p role="status" className="mt-6 text-muted-foreground">
        {page > 1 ? "No more stories" : "No stories"} match &ldquo;{q}&rdquo;. Try fewer or different words.
      </p>
    );
  }
  return (
    <section aria-label="Story results" className="mt-2">
      <ul>
        {items.map((item) => (
          <li key={item.id} className="border-b border-rule py-5">
            <StoryCard item={item} imageUrl={articleImageUrl} />
          </li>
        ))}
      </ul>
      {page > 1 || (hasMore && page < SEARCH_MAX_PAGE) ? (
        <nav aria-label="Pages" className="mt-6 flex flex-wrap justify-center gap-3">
          {page > 1 ? (
            <Link href={searchHref({ q, page: page - 1 })} className={BUTTON}>
              Previous
            </Link>
          ) : null}
          {hasMore && page < SEARCH_MAX_PAGE ? (
            <Link href={searchHref({ q, page: page + 1 })} className={BUTTON}>
              More results
            </Link>
          ) : null}
        </nav>
      ) : null}
    </section>
  );
}

async function WriterResults({ client, q }: { client: Client; q: string }) {
  const writers = await searchWriters(client, q);
  if (!writers.length) {
    return (
      <p role="status" className="mt-6 text-muted-foreground">
        No writers match &ldquo;{q}&rdquo;.
      </p>
    );
  }
  return (
    <section aria-label="Writer results" className="mt-2">
      <ul>
        {writers.map((w) => (
          <li key={w.id} className="border-b border-rule py-4">
            <Link href={`/u/${w.handle}`} className="group flex items-center gap-4">
              <Avatar name={w.display_name} src={avatarUrl(w.avatar_path)} size={56} />
              <span className="min-w-0">
                <span className="block font-serif text-lg font-semibold group-hover:underline">{w.display_name}</span>
                <span className="block text-sm text-muted-foreground">@{w.handle}</span>
                {w.bio ? <span className="mt-1 line-clamp-2 block text-sm">{w.bio}</span> : null}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
