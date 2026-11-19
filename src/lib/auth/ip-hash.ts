import "server-only";
import { createHash } from "node:crypto";

/** First address in X-Forwarded-For (set by Vercel), else X-Real-IP. */
export function clientIp(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip")?.trim() || null;
}

/**
 * sha256(salt || ip) as hex, or null when there is no IP or no salt. Without a
 * secret salt an IPv4 hash is trivially reversible, so we store nothing.
 */
export function hashIp(ip: string | null, salt = process.env.IP_HASH_SALT): string | null {
  if (!ip || !salt || salt.length < 16) return null;
  return createHash("sha256").update(salt).update(ip).digest("hex");
}
