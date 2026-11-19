/**
 * The only rich-text structure stored and rendered for article bodies.
 * Anything not listed here is dropped by `sanitizeRichDoc`.
 * Keep in sync with `editorExtensions` (checked by extensions.test.ts).
 */

export const ALLOWED_NODES = [
  "doc",
  "paragraph",
  "heading",
  "text",
  "hardBreak",
  "bulletList",
  "orderedList",
  "listItem",
  "blockquote",
] as const;

export const ALLOWED_MARKS = ["bold", "italic", "link"] as const;

export const HEADING_LEVELS = [2, 3] as const;

/** Same cap as the `articles.body_json` check constraint. */
export const MAX_DOC_BYTES = 100_000;
/** Nesting deeper than this (lists in quotes in lists...) is dropped. */
export const MAX_DEPTH = 8;
export const MAX_URL_LENGTH = 2000;

export type Mark =
  | { type: "bold" }
  | { type: "italic" }
  | { type: "link"; attrs: { href: string } };

export type TextNode = { type: "text"; text: string; marks?: Mark[] };
export type HardBreak = { type: "hardBreak" };
export type InlineNode = TextNode | HardBreak;

export type Paragraph = { type: "paragraph"; content?: InlineNode[] };
export type Heading = { type: "heading"; attrs: { level: 2 | 3 }; content?: InlineNode[] };
export type ListItem = { type: "listItem"; content: BlockNode[] };
export type BulletList = { type: "bulletList"; content: ListItem[] };
export type OrderedList = { type: "orderedList"; attrs?: { start: number }; content: ListItem[] };
export type Blockquote = { type: "blockquote"; content: BlockNode[] };
export type BlockNode = Paragraph | Heading | BulletList | OrderedList | Blockquote;

export type RichDoc = { type: "doc"; content: BlockNode[] };

export const EMPTY_DOC: RichDoc = { type: "doc", content: [] };
