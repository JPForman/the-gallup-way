/**
 * Top Stories score. Mirrors SQL public.ranking_score() in
 * supabase/migrations/20261120030000_views_and_top_stories.sql; both are
 * tested with the same cases (src/lib/ranking.test.ts, supabase/tests/100_*).
 *
 *   score = (likes + 2·comments + views/25) / (hours_since_publish + 2)^1.5
 *
 * Only stories published in the last TOP_WINDOW_DAYS are ranked.
 */
export const TOP_WINDOW_DAYS = 7;

export type RankingInput = { likes: number; comments: number; views: number; hoursSincePublish: number };

export function rankingScore({ likes, comments, views, hoursSincePublish }: RankingInput): number {
  const hours = Math.max(hoursSincePublish, 0);
  return (likes + 2 * comments + views / 25) / Math.pow(hours + 2, 1.5);
}

export function hoursSince(publishedAt: string | Date, now: Date = new Date()): number {
  return (now.getTime() - new Date(publishedAt).getTime()) / 3_600_000;
}
