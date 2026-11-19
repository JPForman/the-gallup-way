"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { SITE_TIMEZONE } from "@/lib/site";

const BOT_UA = /bot|crawl|spider|slurp|preview|facebookexternalhit|headless/i;

/** Gallup-local date, e.g. "2026-11-19" (one counted view per story per day). */
export function localDay(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: SITE_TIMEZONE }).format(now);
}

export function viewKey(articleId: string, day: string): string {
  return `viewed:${articleId}:${day}`;
}

/**
 * Counts one view of a story per browser per day. Runs in the browser and
 * calls Supabase directly (record_view), so the cached page stays static and
 * no Vercel function runs. The database ignores the author's own views.
 */
export function ViewCounter({ articleId }: { articleId: string }) {
  useEffect(() => {
    if (BOT_UA.test(navigator.userAgent)) return;
    const key = viewKey(articleId, localDay());
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, "1");
    } catch {
      // Storage blocked (private mode): count anyway; the daily dedupe is best effort.
    }
    void createClient()
      .rpc("record_view", { p_article_id: articleId })
      .then(() => undefined, () => undefined);
  }, [articleId]);
  return null;
}
