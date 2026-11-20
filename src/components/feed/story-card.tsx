import Link from "next/link";
import { articleKicker, formatArticleDate } from "@/components/article/article-view";
import type { FeedItem } from "@/lib/db/articles";
import { excerpt } from "@/lib/richtext";
import { cn } from "@/lib/utils";

function Byline({ item }: { item: FeedItem }) {
  return (
    <p className="mt-2 text-sm text-muted-foreground">
      By <span className="font-medium text-foreground">{item.author_display_name ?? "Former member"}</span>
      {" · "}
      <time dateTime={item.published_at}>{formatArticleDate(item.published_at)}</time>
    </p>
  );
}

function Kicker({ item }: { item: FeedItem }) {
  const text = articleKicker(item);
  return text ? <p className="text-xs font-bold tracking-widest text-brand uppercase">{text}</p> : null;
}

/** A story in a feed. `lead` is the large top story on the home page. */
export function StoryCard({
  item,
  imageUrl,
  lead = false,
}: {
  item: FeedItem;
  imageUrl: (path: string) => string;
  lead?: boolean;
}) {
  const href = `/a/${item.slug}`;
  const summary = item.dek ?? excerpt(item.excerpt, lead ? 220 : 140);
  const img = item.image_path ? (
    // eslint-disable-next-line @next/next/no-img-element -- public CDN WebP, no optimization (free tier)
    <img
      src={imageUrl(item.image_path)}
      alt={item.image_alt ?? ""}
      loading={lead ? "eager" : "lazy"}
      decoding="async"
      className={cn(
        "rounded-md bg-muted object-cover",
        lead ? "aspect-[3/2] w-full" : "size-24 shrink-0 md:aspect-[3/2] md:h-auto md:w-full",
      )}
    />
  ) : null;

  if (lead) {
    return (
      <article className="grid gap-5 md:grid-cols-5 md:items-center md:gap-8">
        {img ? <div className="md:col-span-3">{img}</div> : null}
        <div className={img ? "md:col-span-2" : "md:col-span-5"}>
          <Kicker item={item} />
          <h2 className="mt-2 font-serif text-3xl leading-tight font-bold tracking-tight break-words md:text-4xl">
            <Link href={href} className="underline-offset-4 hover:underline">
              {item.title}
            </Link>
          </h2>
          {summary ? <p className="mt-3 text-lg text-muted-foreground">{summary}</p> : null}
          <Byline item={item} />
        </div>
      </article>
    );
  }

  return (
    <article className="flex gap-4 md:flex-col-reverse md:gap-3">
      <div className="min-w-0 flex-1">
        <Kicker item={item} />
        <h3 className="mt-1 font-serif text-xl leading-snug font-semibold break-words">
          <Link href={href} className="underline-offset-4 hover:underline">
            {item.title}
          </Link>
        </h3>
        {summary ? <p className="mt-1 hidden text-sm text-muted-foreground sm:block">{summary}</p> : null}
        <Byline item={item} />
      </div>
      {img}
    </article>
  );
}

/** Grid of standard cards: one column on mobile, 2–3 on larger screens. */
export function StoryGrid({
  items,
  imageUrl,
  columns = 3,
}: {
  items: FeedItem[];
  imageUrl: (path: string) => string;
  /** At most this many columns on wide screens (2 for narrow pages like profiles). */
  columns?: 2 | 3;
}) {
  return (
    <ul className={cn("grid gap-x-8 md:grid-cols-2", columns === 3 && "lg:grid-cols-3")}>
      {items.map((item) => (
        <li key={item.id} className="border-t border-rule py-5">
          <StoryCard item={item} imageUrl={imageUrl} />
        </li>
      ))}
    </ul>
  );
}
