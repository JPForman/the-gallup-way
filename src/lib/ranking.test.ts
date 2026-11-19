import { describe, expect, it } from "vitest";
import { hoursSince, rankingScore } from "./ranking";

describe("rankingScore (same cases as supabase/tests/100_views_top_stories.test.sql)", () => {
  it("weighs likes, comments and views over age", () => {
    // (10 + 4 + 2) / 5^1.5
    expect(rankingScore({ likes: 10, comments: 2, views: 50, hoursSincePublish: 3 })).toBeCloseTo(1.431084, 6);
  });

  it("scores 0 without engagement", () => {
    expect(rankingScore({ likes: 0, comments: 0, views: 0, hoursSincePublish: 0 })).toBe(0);
  });

  it("treats future dates as 0 hours", () => {
    expect(rankingScore({ likes: 0, comments: 0, views: 25, hoursSincePublish: -5 })).toBeCloseTo(0.353553, 6);
  });

  it("decays with age", () => {
    const fresh = rankingScore({ likes: 5, comments: 0, views: 0, hoursSincePublish: 1 });
    const day = rankingScore({ likes: 5, comments: 0, views: 0, hoursSincePublish: 24 });
    expect(fresh).toBeGreaterThan(day * 10);
  });

  it("counts a comment as two likes and 25 views as one like", () => {
    const like = rankingScore({ likes: 2, comments: 0, views: 0, hoursSincePublish: 5 });
    expect(rankingScore({ likes: 0, comments: 1, views: 0, hoursSincePublish: 5 })).toBeCloseTo(like);
    expect(rankingScore({ likes: 0, comments: 0, views: 50, hoursSincePublish: 5 })).toBeCloseTo(like);
  });
});

describe("hoursSince", () => {
  it("measures hours", () => {
    expect(hoursSince("2026-11-19T12:00:00Z", new Date("2026-11-19T15:30:00Z"))).toBe(3.5);
  });
});
