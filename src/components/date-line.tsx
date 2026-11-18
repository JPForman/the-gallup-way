"use client";

import { SITE_LOCATION, SITE_TIMEZONE } from "@/lib/site";

export function formatDateLine(date: Date): string {
  return date
    .toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: SITE_TIMEZONE,
    })
    .toUpperCase();
}

/** Rendered on the client so a statically built page always shows today's date. */
export function DateLine() {
  return (
    <p
      className="text-[0.7rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase"
      suppressHydrationWarning
    >
      {formatDateLine(new Date())} · {SITE_LOCATION}
    </p>
  );
}
