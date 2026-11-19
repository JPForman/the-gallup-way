import { expect, test } from "@playwright/test";
import { newSignedInUser } from "./helpers/auth";
import { sql, userIdByEmail } from "./helpers/db";
import { gotoReady } from "./helpers/page";

const AFTER_ACTION = { timeout: 30_000 };

test("a published story appears on its category page, not on others", async ({ page }) => {
  test.slow();
  const { email } = await newSignedInUser(page, "catwriter");
  await sql`update public.profiles set approved_article_count = 3 where id = ${await userIdByEmail(email)}`;
  const title = `School board meets ${Date.now().toString(36)}`;

  await gotoReady(page, "/write");
  await page.getByLabel("Headline").fill(title);
  await page.getByLabel("Category").selectOption("education");
  await page.getByRole("textbox", { name: "Story" }).click();
  await page.keyboard.type("The school board meets Tuesday.");
  await page.getByLabel(/I agree to the Contributor Agreement/).check();
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(page).toHaveURL(/\?notice=published$/, AFTER_ACTION);

  await expect(async () => {
    await page.goto("/c/education");
    await expect(page.getByRole("link", { name: title })).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 20_000 });
  await expect(page.getByRole("heading", { level: 1, name: "Education" })).toBeVisible();
  await expect(page).toHaveTitle(/^Education/);
  const nav = page.getByRole("navigation", { name: "Categories" });
  await expect(nav.getByRole("link", { name: "Education" })).toHaveAttribute("aria-current", "page");
  await expect(nav.getByRole("link", { name: "Sports" })).not.toHaveAttribute("aria-current");

  await page.goto("/c/sports");
  await expect(page.getByRole("heading", { level: 1, name: "Sports" })).toBeVisible();
  await expect(page.getByRole("link", { name: title })).toHaveCount(0);
});

test("unknown categories and bad cursors are not found", async ({ page }) => {
  expect((await page.goto("/c/weather"))?.status()).toBe(404);
  expect((await page.goto("/c/news/not-a-cursor"))?.status()).toBe(404);
});
