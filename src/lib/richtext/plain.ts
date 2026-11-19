/**
 * Plain text from a rich document. Mirrors `public.richtext_plain()` in
 * supabase/migrations/20261119010000_articles.sql exactly: inline text in
 * paragraphs/headings is joined as-is, hard breaks become "\n", and non-empty
 * blocks are separated by "\n". Works on raw (unsanitized) JSON too.
 */
export function richTextToPlain(node: unknown): string {
  if (typeof node !== "object" || node === null || Array.isArray(node)) return "";
  const n = node as { type?: unknown; text?: unknown; content?: unknown };
  if (n.type === "text") return typeof n.text === "string" ? n.text : "";
  if (n.type === "hardBreak") return "\n";
  if (!Array.isArray(n.content)) return "";

  const inline = n.type === "paragraph" || n.type === "heading";
  let out = "";
  for (const child of n.content) {
    const piece = richTextToPlain(child);
    if (inline) out += piece;
    else if (piece !== "") out = out === "" ? piece : `${out}\n${piece}`;
  }
  return out;
}

/** A short single-line preview, cut at a word boundary. */
export function excerpt(text: string, maxChars = 200): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= maxChars) return flat;
  const cut = flat.slice(0, maxChars + 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > maxChars * 0.5 ? cut.slice(0, lastSpace) : flat.slice(0, maxChars)).trimEnd()}…`;
}

export function isEmptyRichText(node: unknown): boolean {
  return richTextToPlain(node).trim() === "";
}
