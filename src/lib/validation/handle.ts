/**
 * Mirrors public.is_valid_handle() in supabase/migrations (kept in sync by
 * handle.test.ts). The database is the source of truth; this is for fast,
 * friendly form errors.
 */
export const HANDLE_PATTERN = /^[a-z0-9_]{3,30}$/;

export const RESERVED_HANDLES: ReadonlySet<string> = new Set([
  "admin", "administrator", "moderator", "mod", "staff", "support", "help",
  "official", "system", "root", "null", "undefined", "anonymous",
  "thegallupway", "gallupway", "gallup_way", "the_gallup_way",
  "me", "settings", "write", "edit", "search", "saved", "legal", "auth",
  "api", "admin_", "contact", "about", "new",
]);

export function normalizeHandle(raw: string): string {
  return raw.trim().replace(/^@/, "").toLowerCase();
}

export function isValidHandle(handle: string): boolean {
  return HANDLE_PATTERN.test(handle) && !RESERVED_HANDLES.has(handle);
}
