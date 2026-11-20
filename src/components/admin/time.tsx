import { SITE_TIMEZONE } from "@/lib/site";

const fmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: SITE_TIMEZONE,
});

export function formatAdminTime(iso: string): string {
  return fmt.format(new Date(iso));
}

/** A timestamp in Gallup time, server-safe. */
export function Time({ iso }: { iso: string }) {
  return <time dateTime={iso}>{formatAdminTime(iso)}</time>;
}
