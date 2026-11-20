import { expect, test } from "@playwright/test";
import { newSignedInUser } from "./helpers/auth";
import { sql, userIdByEmail } from "./helpers/db";
import { storyByAnotherAuthor } from "./helpers/stories";

test("a writer's profile lists their published stories and contributor stats", async ({ page }) => {
  const { id, slug, authorId, authorHandle } = await storyByAnotherAuthor("profiled");
  const reader = await newSignedInUser(page, "statsreader");
  const readerId = await userIdByEmail(reader.email);
  // Engagement before the profile is first rendered (it's cached for 60s after).
  await sql`insert into public.reactions (article_id, user_id) values (${id}, ${readerId})`;
  await sql`insert into public.comments (article_id, author_id, body) values (${id}, ${readerId}, 'Great read')`;
  await sql`insert into public.article_views (article_id, day, views) values (${id}, (now() at time zone 'America/Denver')::date, 7)`;

  await page.goto(`/u/${authorHandle}`);
  const stats = page.getByRole("definition");
  await expect(stats).toHaveCount(4);
  await expect(stats.nth(0)).toHaveText("1story");
  await expect(stats.nth(1)).toHaveText("1like");
  await expect(stats.nth(2)).toHaveText("1comment");
  await expect(stats.nth(3)).toHaveText("7reads");
  await expect(page.getByRole("link", { name: `profiled story ${authorId.slice(0, 8)}` })).toHaveAttribute("href", `/a/${slug}`);
});

test("people without published stories show no stats", async ({ page }) => {
  const { handle } = await newSignedInUser(page, "nostats");
  await page.goto(`/u/${handle}`);
  await expect(page.getByText("No stories yet.")).toBeVisible();
  await expect(page.getByRole("definition")).toHaveCount(0);
});
