import {
  MAX_DEPTH,
  MAX_DOC_BYTES,
  MAX_URL_LENGTH,
  type BlockNode,
  type InlineNode,
  type ListItem,
  type Mark,
  type RichDoc,
} from "./schema";

type Json = Record<string, unknown>;

function isObject(v: unknown): v is Json {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function children(v: Json): unknown[] {
  return Array.isArray(v.content) ? v.content : [];
}

/**
 * Returns a normalized absolute http(s) URL, or null if the value is unsafe
 * (javascript:, data:, relative, protocol-relative, too long...).
 */
export function safeHref(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  // Browsers ignore ASCII whitespace and control characters inside schemes
  // ("java\nscript:"), so strip them before checking.
  const cleaned = raw.replace(/[\u0000- \u007f-\u009f]/g, "");
  if (cleaned.length === 0 || cleaned.length > MAX_URL_LENGTH) return null;
  if (!/^https?:\/\//i.test(cleaned)) return null;
  let url: URL;
  try {
    url = new URL(cleaned);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (!url.hostname) return null;
  // Credentials in links are a phishing trick ("https://bank.com@evil.test").
  if (url.username || url.password) return null;
  return url.href.length > MAX_URL_LENGTH ? null : url.href;
}

function sanitizeMarks(raw: unknown): Mark[] {
  if (!Array.isArray(raw)) return [];
  const out: Mark[] = [];
  const seen = new Set<string>();
  for (const m of raw) {
    if (!isObject(m) || typeof m.type !== "string" || seen.has(m.type)) continue;
    if (m.type === "bold" || m.type === "italic") {
      out.push({ type: m.type });
      seen.add(m.type);
    } else if (m.type === "link") {
      const href = safeHref(isObject(m.attrs) ? m.attrs.href : undefined);
      if (href) {
        out.push({ type: "link", attrs: { href } });
        seen.add("link");
      }
    }
  }
  return out;
}

function sanitizeInline(raw: unknown[]): InlineNode[] {
  const out: InlineNode[] = [];
  for (const n of raw) {
    if (!isObject(n)) continue;
    if (n.type === "hardBreak") {
      out.push({ type: "hardBreak" });
    } else if (n.type === "text" && typeof n.text === "string" && n.text.length > 0) {
      const marks = sanitizeMarks(n.marks);
      out.push(marks.length ? { type: "text", text: n.text, marks } : { type: "text", text: n.text });
    }
  }
  return out;
}

function sanitizeListItems(raw: unknown[], depth: number): ListItem[] {
  const items: ListItem[] = [];
  for (const n of raw) {
    if (!isObject(n) || n.type !== "listItem") continue;
    const content = sanitizeBlocks(children(n), depth + 1);
    items.push({ type: "listItem", content: content.length ? content : [{ type: "paragraph" }] });
  }
  return items;
}

function sanitizeBlocks(raw: unknown[], depth: number): BlockNode[] {
  if (depth > MAX_DEPTH) return [];
  const out: BlockNode[] = [];
  for (const n of raw) {
    if (!isObject(n)) continue;
    switch (n.type) {
      case "paragraph": {
        const content = sanitizeInline(children(n));
        out.push(content.length ? { type: "paragraph", content } : { type: "paragraph" });
        break;
      }
      case "heading": {
        const rawLevel = isObject(n.attrs) ? Number(n.attrs.level) : 2;
        const level: 2 | 3 = rawLevel >= 3 ? 3 : 2;
        const content = sanitizeInline(children(n));
        out.push(
          content.length
            ? { type: "heading", attrs: { level }, content }
            : { type: "heading", attrs: { level } },
        );
        break;
      }
      case "bulletList":
      case "orderedList": {
        const content = sanitizeListItems(children(n), depth);
        if (!content.length) break;
        if (n.type === "bulletList") {
          out.push({ type: "bulletList", content });
        } else {
          const start = isObject(n.attrs) ? Number(n.attrs.start) : 1;
          out.push(
            Number.isInteger(start) && start > 1 && start <= 10_000
              ? { type: "orderedList", attrs: { start }, content }
              : { type: "orderedList", content },
          );
        }
        break;
      }
      case "blockquote": {
        const content = sanitizeBlocks(children(n), depth + 1);
        if (content.length) out.push({ type: "blockquote", content });
        break;
      }
      default:
        // Unknown block types (images, code, html, iframes...) are dropped.
        break;
    }
  }
  return out;
}

/** Rebuilds a document keeping only allowlisted nodes, marks and attributes. */
export function sanitizeRichDoc(raw: unknown): RichDoc {
  if (!isObject(raw) || raw.type !== "doc") return { type: "doc", content: [] };
  return { type: "doc", content: sanitizeBlocks(children(raw), 1) };
}

/** Size as stored by Postgres (UTF-8 of the JSON text). */
export function richDocBytes(doc: RichDoc): number {
  return new TextEncoder().encode(JSON.stringify(doc)).length;
}

export function isWithinSizeLimit(doc: RichDoc): boolean {
  return richDocBytes(doc) <= MAX_DOC_BYTES;
}
