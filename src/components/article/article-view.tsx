import Link from "next/link";
import { CorrectionsList } from "@/components/corrections-list";
import type { PublicArticle } from "@/lib/db/articles";
import { RichText, safeHref, UGC_LINK_REL } from "@/lib/richtext";
import { CATEGORIES, SITE_NAME, SITE_TIMEZONE } from "@/lib/site";
import { CONTENT_TYPES } from "@/lib/validation/article";

const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
  timeZone: SITE_TIMEZONE,
});

export function formatArticleDate(iso: string): string {
  return dateFmt.format(new Date(iso));
}

export function isOpinion(article: Pick<PublicArticle, "category" | "content_type">): boolean {
  return article.content_type === "opinion" || article.category === "opinion";
}

/** "Community · News report", "News report" (not "News · News report"), or "Opinion". */
export function articleKicker(article: Pick<PublicArticle, "category" | "content_type">): string {
  if (isOpinion(article)) return "Opinion";
  const category = CATEGORIES.find((c) => c.slug === article.category)?.name;
  const type = CONTENT_TYPES.find((t) => t.value === article.content_type)?.label;
  // "News · News report" reads as a stutter: show just "News report".
  if (category && type?.startsWith(category)) return type;
  return [category, type].filter(Boolean).join(" · ");
}

type Image = PublicArticle["images"][number];

function Figure({ image, src, lead }: { image: Image; src: string; lead?: boolean }) {
  const note = [image.caption, image.credit ? `Photo: ${image.credit}` : null].filter(Boolean).join(" ");
  return (
    <figure className={lead ? "mt-6" : "my-8"}>
      {/* eslint-disable-next-line @next/next/no-img-element -- public CDN WebP, no optimization (free tier) */}
      <img
        src={src}
        alt={image.alt_text}
        loading={lead ? "eager" : "lazy"}
        decoding="async"
        className="w-full rounded-md bg-muted object-cover"
      />
      {note ? <figcaption className="mt-2 text-sm text-muted-foreground">{note}</figcaption> : null}
    </figure>
  );
}

/** The public article layout. Pure rendering: data comes from getPublishedArticle(). */
export function ArticleView({
  article,
  imageUrl,
}: {
  article: PublicArticle;
  imageUrl: (path: string) => string;
}) {
  const [lead, ...moreImages] = article.images;
  const opinion = isOpinion(article);
  const kicker = articleKicker(article);
  const categoryHref = article.category ? `/c/${article.category}` : null;

  return (
    <article className="mx-auto w-full max-w-2xl px-4 py-8 md:py-12">
      <header>
        <p className="text-xs font-bold tracking-widest text-brand uppercase">
          {categoryHref && !opinion ? (
            <Link href={categoryHref} className="underline-offset-4 hover:underline">
              {kicker}
            </Link>
          ) : (
            kicker
          )}
        </p>
        <h1 className="mt-2 font-serif text-3xl leading-tight font-bold tracking-tight break-words md:text-4xl">
          {article.title}
        </h1>
        {article.dek ? <p className="mt-3 text-lg text-muted-foreground">{article.dek}</p> : null}

        <div className="mt-5 border-y border-rule py-3 text-sm">
          <p>
            By{" "}
            {article.author ? (
              <Link
                href={`/u/${article.author.handle}`}
                className="font-semibold underline-offset-4 hover:underline"
              >
                {article.author.display_name}
              </Link>
            ) : (
              <span className="font-semibold">Former member</span>
            )}{" "}
            · Posted by a community member
          </p>
          <p className="mt-1 text-muted-foreground">
            {article.published_at ? (
              <>
                Posted <time dateTime={article.published_at}>{formatArticleDate(article.published_at)}</time>
              </>
            ) : null}
            {article.edited_at ? (
              <>
                {" "}
                · Updated <time dateTime={article.edited_at}>{formatArticleDate(article.edited_at)}</time>
              </>
            ) : null}
          </p>
        </div>
      </header>

      {opinion ? (
        <p className="mt-6 rounded-md border border-border bg-muted p-3 text-sm">
          <span className="font-semibold">Opinion.</span> This piece shares the author&apos;s own views.
        </p>
      ) : null}

      {lead ? <Figure image={lead} src={imageUrl(lead.storage_path)} lead /> : null}

      <RichText doc={article.body_json} className="mt-6" />

      {moreImages.map((img) => (
        <Figure key={img.storage_path} image={img} src={imageUrl(img.storage_path)} />
      ))}

      {article.sources.length ? (
        <section aria-labelledby="sources-heading" className="mt-10 border-t border-rule pt-6">
          <h2 id="sources-heading" className="font-serif text-xl font-semibold">
            Sources
          </h2>
          <ul className="mt-3 list-disc space-y-1 pl-5">
            {article.sources.map((s, i) => {
              const href = safeHref(s.url);
              const text = s.label ?? s.url;
              return (
                <li key={i} className="break-words">
                  {href ? (
                    <a href={href} rel={UGC_LINK_REL} target="_blank" className="underline underline-offset-4">
                      {text}
                    </a>
                  ) : (
                    text
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {article.corrections.length ? (
        <section aria-labelledby="corrections-heading" className="mt-10">
          <h2 id="corrections-heading" className="sr-only">
            Corrections
          </h2>
          <CorrectionsList corrections={article.corrections} />
        </section>
      ) : null}

      <aside aria-label="Disclaimer" className="mt-10 border-t border-rule pt-6 text-sm text-muted-foreground">
        This story was posted by a community member. The views and claims in it are the author&apos;s and
        have not been independently verified by {SITE_NAME}. Spot a mistake? See our{" "}
        <Link href="/legal/corrections" className="underline underline-offset-4">
          corrections policy
        </Link>
        .
      </aside>
    </article>
  );
}
