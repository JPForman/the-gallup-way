import { expect, test } from "@playwright/test";
import { newSignedInUser } from "./helpers/auth";
import { sql, userIdByEmail } from "./helpers/db";
import { gotoReady } from "./helpers/page";

const AFTER_ACTION = { timeout: 30_000 };

test("home shows the newest story as the lead, then Latest, with pages of older stories", async ({ page, isMobile }) => {
  // Both projects would insert "newest" stories at once and interleave, so run
  // this on desktop only (the mobile layout is covered by smoke.spec.ts).
  test.skip(isMobile, "desktop only: shares the global feed");
  test.slow();
  const { email } = await newSignedInUser(page, "feedwriter");
  const userId = await userIdByEmail(email);
  await sql`update public.profiles set approved_article_count = 3, display_name = 'Feed Writer' where id = ${userId}`;

  // 21 stories dated in the future, so they are the newest on the board even
  // (submitted 2 days ago, so they don't count toward the 5-a-day limit)
  // while other specs publish (F01 oldest ... F21 newest).
  const run = Date.now().toString(36);
  await sql`
    insert into public.articles (author_id, slug, title, category, body_json, status, submitted_at, published_at)
    select ${userId}::uuid, 'feed-' || ${run} || '-' || lpad(g::text, 2, '0'),
      'Feed ' || ${run} || ' F' || lpad(g::text, 2, '0'), 'news',
      '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Feed body."}]}]}',
      'published', now() - interval '2 days', now() + interval '1 day' + g * interval '1 second'
    from generate_series(1, 21) g`;

  try {
    // Publishing through the app revalidates the cached home page.
    await gotoReady(page, "/write");
    await page.getByLabel("Headline").fill(`Feed ${run} trigger`);
    await page.getByLabel("Category").selectOption("news");
    await page.getByRole("textbox", { name: "Story" }).click();
    await page.keyboard.type("Refreshes the front page.");
    await page.getByLabel(/I agree to the Contributor Agreement/).check();
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await expect(page).toHaveURL(/\?notice=published$/, AFTER_ACTION);

    const topStory = page.getByRole("region", { name: "Top story" });
    await expect(async () => {
      await page.goto("/");
      await expect(topStory.getByRole("heading", { level: 2 })).toHaveText(`Feed ${run} F21`, { timeout: 1000 });
    }).toPass({ timeout: 20_000 });
    await expect(topStory.getByText("Feed Writer")).toBeVisible();

    const latest = page.getByRole("region", { name: "Latest" });
    await expect(latest.getByRole("listitem")).toHaveCount(19);
    await expect(latest.getByRole("link", { name: `Feed ${run} F02` })).toBeVisible();
    await expect(page.getByRole("link", { name: `Feed ${run} F01` })).toHaveCount(0);

    // Page 2 continues exactly where page 1 stopped.
    await page.getByRole("link", { name: "More stories" }).click();
    await expect(page).toHaveURL(/\/latest\/[A-Za-z0-9_-]+$/);
    await expect(page.getByRole("heading", { level: 1, name: "More stories" })).toBeVisible();
    const first = page.getByRole("main").getByRole("listitem").first();
    await expect(first.getByRole("heading")).toHaveText(`Feed ${run} F01`);
    await expect(page.getByRole("link", { name: `Feed ${run} F02` })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Front page" })).toBeVisible();

    await page.getByRole("link", { name: `Feed ${run} F01` }).click();
    await expect(page.getByRole("heading", { level: 1, name: `Feed ${run} F01` })).toBeVisible();
  } finally {
    await sql`delete from public.articles where author_id = ${userId}`;
  }
});

test("a malformed feed cursor is a 404", async ({ page }) => {
  const res = await page.goto("/latest/not-a-cursor");
  expect(res?.status()).toBe(404);
});
