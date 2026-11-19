import { z } from "zod";
import { CATEGORIES } from "@/lib/site";
import { isEmptyRichText, isWithinSizeLimit, safeHref, sanitizeRichDoc, type RichDoc } from "@/lib/richtext";

/** Matches the DB checks in 20261119010000_articles.sql. */
export const ARTICLE_LIMITS = {
  title: 120,
  dek: 240,
  sources: 10,
  sourceLabel: 200,
  images: 3,
  altText: 300,
  caption: 300,
  credit: 120,
} as const;

export const CONTENT_TYPES = [
  { value: "news", label: "News report" },
  { value: "community", label: "Community" },
  { value: "opinion", label: "Opinion" },
  { value: "event", label: "Event" },
  { value: "sports", label: "Sports" },
  { value: "business", label: "Business" },
] as const;

export type ContentType = (typeof CONTENT_TYPES)[number]["value"];

const contentTypeValues = CONTENT_TYPES.map((c) => c.value) as [ContentType, ...ContentType[]];
const categorySlugs = CATEGORIES.map((c) => c.slug) as [string, ...string[]];

/** <user id>/<article id>/<name>.webp, the article-images path rule. */
export function isArticleImagePath(path: string, userId: string, articleId: string): boolean {
  return (
    path.startsWith(`${userId}/${articleId}/`) &&
    /^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[a-z0-9-]{1,64}\.webp$/.test(path)
  );
}

const fieldsSchema = z.object({
  articleId: z
    .string()
    .transform((v) => (v === "" ? undefined : v))
    .pipe(z.uuid().optional()),
  title: z.string().trim().max(ARTICLE_LIMITS.title, `Keep the headline to ${ARTICLE_LIMITS.title} characters.`),
  dek: z
    .string()
    .trim()
    .max(ARTICLE_LIMITS.dek, `Keep the summary to ${ARTICLE_LIMITS.dek} characters.`)
    .transform((v) => (v === "" ? undefined : v)),
  category: z
    .union([z.enum(categorySlugs), z.literal("")], { error: "Choose a category from the list." })
    .transform((v) => (v === "" ? undefined : v)),
  contentType: z.enum(contentTypeValues, { error: "Choose a story type from the list." }),
  body: z.string(),
});

export type ArticleSource = { url: string; label: string | null };
export type ArticleImageInput = {
  storage_path: string;
  alt_text: string;
  caption: string | null;
  credit: string | null;
};

export type ArticleInput = {
  articleId?: string;
  title: string;
  dek?: string;
  category?: string;
  contentType: ContentType;
  body: RichDoc;
  sources: ArticleSource[];
  images: ArticleImageInput[];
};

export type ArticleFieldErrors = Partial<
  Record<"title" | "dek" | "category" | "contentType" | "body" | "sources" | "images" | "agreement", string[]>
>;

type ParseResult = { ok: true; data: ArticleInput } | { ok: false; fieldErrors: ArticleFieldErrors };

const str = (v: FormDataEntryValue | null | undefined) => (typeof v === "string" ? v : "");
const all = (fd: FormData, key: string) => fd.getAll(key).map(str);

function parseBody(raw: string): RichDoc | null {
  if (raw.trim() === "") return { type: "doc", content: [] };
  try {
    return sanitizeRichDoc(JSON.parse(raw));
  } catch {
    return null;
  }
}

/**
 * Validates the editor form. Repeated fields: sourceUrl/sourceLabel and
 * imagePath/imageAlt/imageCaption/imageCredit, in display order.
 */
export function parseArticleForm(formData: FormData, userId: string): ParseResult {
  const errors: ArticleFieldErrors = {};
  const fields = fieldsSchema.safeParse({
    articleId: str(formData.get("articleId")),
    title: str(formData.get("title")),
    dek: str(formData.get("dek")),
    category: str(formData.get("category")),
    contentType: str(formData.get("contentType")) || "news",
    body: str(formData.get("body")),
  });
  if (!fields.success) {
    Object.assign(errors, z.flattenError(fields.error).fieldErrors);
  }

  const body = parseBody(str(formData.get("body")));
  if (!body) errors.body = ["We couldn't read the story text. Please try again."];
  else if (!isWithinSizeLimit(body)) errors.body = ["This story is too long. Please shorten it."];

  // Sources
  const urls = all(formData, "sourceUrl");
  const labels = all(formData, "sourceLabel");
  const sources: ArticleSource[] = [];
  const sourceErrors: string[] = [];
  urls.forEach((rawUrl, i) => {
    const url = rawUrl.trim();
    const label = (labels[i] ?? "").trim();
    if (url === "" && label === "") return;
    const href = safeHref(url);
    if (!href) sourceErrors.push(`Source ${i + 1}: enter a full web address starting with https://`);
    else if (label.length > ARTICLE_LIMITS.sourceLabel)
      sourceErrors.push(`Source ${i + 1}: keep the label to ${ARTICLE_LIMITS.sourceLabel} characters.`);
    else sources.push({ url: href, label: label || null });
  });
  if (sources.length > ARTICLE_LIMITS.sources) sourceErrors.push(`Add at most ${ARTICLE_LIMITS.sources} sources.`);
  if (sourceErrors.length) errors.sources = sourceErrors;

  // Images (only on an existing story: files live in its folder)
  const paths = all(formData, "imagePath");
  const alts = all(formData, "imageAlt");
  const captions = all(formData, "imageCaption");
  const credits = all(formData, "imageCredit");
  const images: ArticleImageInput[] = [];
  const imageErrors: string[] = [];
  const articleId = fields.success ? fields.data.articleId : undefined;
  paths.forEach((path, i) => {
    const n = i + 1;
    const alt = (alts[i] ?? "").trim();
    const caption = (captions[i] ?? "").trim();
    const credit = (credits[i] ?? "").trim();
    if (!articleId || !isArticleImagePath(path, userId, articleId)) {
      imageErrors.push(`Photo ${n}: that upload isn't valid. Remove it and try again.`);
    } else if (alt === "") {
      imageErrors.push(`Photo ${n}: describe the photo for people who can't see it.`);
    } else if (alt.length > ARTICLE_LIMITS.altText) {
      imageErrors.push(`Photo ${n}: keep the description to ${ARTICLE_LIMITS.altText} characters.`);
    } else if (caption.length > ARTICLE_LIMITS.caption) {
      imageErrors.push(`Photo ${n}: keep the caption to ${ARTICLE_LIMITS.caption} characters.`);
    } else if (credit.length > ARTICLE_LIMITS.credit) {
      imageErrors.push(`Photo ${n}: keep the credit to ${ARTICLE_LIMITS.credit} characters.`);
    } else {
      images.push({ storage_path: path, alt_text: alt, caption: caption || null, credit: credit || null });
    }
  });
  if (paths.length > ARTICLE_LIMITS.images) imageErrors.push(`Add at most ${ARTICLE_LIMITS.images} photos.`);
  if (imageErrors.length) errors.images = imageErrors;

  if (!fields.success || Object.keys(errors).length || !body) return { ok: false, fieldErrors: errors };

  return {
    ok: true,
    data: {
      articleId: fields.data.articleId,
      title: fields.data.title,
      dek: fields.data.dek,
      category: fields.data.category,
      contentType: fields.data.contentType,
      body,
      sources,
      images,
    },
  };
}

/** Headline length required to publish (matches submit_article()). */
export const MIN_PUBLISH_TITLE = 5;

/**
 * What a story still needs before it can be published, as field errors.
 * Mirrors the checks in submit_article(), so problems show on the fields
 * instead of as a database error.
 */
export function publishProblems(input: ArticleInput): ArticleFieldErrors {
  const problems: ArticleFieldErrors = {};
  if (input.title.trim().length < MIN_PUBLISH_TITLE) {
    problems.title = [`Add a headline of at least ${MIN_PUBLISH_TITLE} characters to publish.`];
  }
  if (!input.category) problems.category = ["Choose a category to publish."];
  if (isEmptyRichText(input.body)) problems.body = ["Write the story before publishing."];
  return problems;
}
