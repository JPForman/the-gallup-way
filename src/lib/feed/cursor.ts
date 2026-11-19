/**
 * Feed cursors: the last row's (published_at, id), base64url-encoded so they
 * fit in a path segment (/latest/<cursor>). published_at is kept as the exact
 * string Postgres returned, because JS Dates drop the microseconds and the
 * keyset comparison would then skip or repeat rows.
 */
export type FeedCursor = { publishedAt: string; id: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/;

export function encodeCursor(c: FeedCursor): string {
  return Buffer.from(`${c.publishedAt}~${c.id}`, "utf8").toString("base64url");
}

export function decodeCursor(raw: string): FeedCursor | null {
  if (!/^[A-Za-z0-9_-]{1,120}$/.test(raw)) return null;
  const [publishedAt, id, ...rest] = Buffer.from(raw, "base64url").toString("utf8").split("~");
  if (rest.length || !publishedAt || !id) return null;
  if (!TIMESTAMP.test(publishedAt) || Number.isNaN(Date.parse(publishedAt)) || !UUID.test(id)) return null;
  return { publishedAt, id };
}
