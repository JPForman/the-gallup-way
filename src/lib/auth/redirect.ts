/**
 * Only allow same-site relative paths as post-auth redirects (prevents open
 * redirects like ?next=//evil.example or ?next=https://evil.example).
 */
export function safeNext(next: unknown, fallback = "/"): string {
  if (typeof next !== "string" || next.length > 2048) return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f]/.test(next)) return fallback;
  return next;
}
