import { expect, test } from "@playwright/test";
import { newSignedInUser } from "./helpers/auth";
import { sql, userIdByEmail } from "./helpers/db";
import { gotoReady } from "./helpers/page";

const AFTER_ACTION = { timeout: 30_000 };

test("a published story has a public page; edits and corrections show up on it", async ({ page, browser }) => {
  test.slow();
  const { email } = await newSignedInUser(page, "articlewriter");
  await sql`update public.profiles set approved_article_count = 3, display_name = 'Article Writer'
    where id = ${await userIdByEmail(email)}`;

  await gotoReady(page, "/write");
  await page.getByLabel("Headline").fill("Rodeo grounds reopen");
  await page.getByLabel("Summary (optional)").fill("New bleachers are in.");
  await page.getByLabel("Category").selectOption("sports");
  await page.getByRole("textbox", { name: "Story" }).click();
  await page.keyboard.type("The rodeo grounds reopen this weekend after repairs.");
  await page.getByLabel(/I agree to the Contributor Agreement/).check();
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(page).toHaveURL(/\?notice=published$/, AFTER_ACTION);
  const href = await page.getByRole("link", { name: "View story" }).getAttribute("href");
  expect(href).toMatch(/^\/a\/rodeo-grounds-reopen-[0-9a-f]{6}$/);

  // A signed-out reader sees the story.
  const reader = await browser.newPage();
  await reader.goto(href!);
  const main = reader.getByRole("main");
  await expect(main.getByRole("heading", { level: 1, name: "Rodeo grounds reopen" })).toBeVisible();
  await expect(main.getByText("New bleachers are in.")).toBeVisible();
  await expect(main.getByText(/By\s+Article Writer\s+· Posted by a community member/)).toBeVisible();
  await expect(main.getByRole("link", { name: "Article Writer" })).toHaveAttribute("href", /^\/u\//);
  await expect(main.getByText("The rodeo grounds reopen this weekend after repairs.")).toBeVisible();
  await expect(main.getByRole("complementary", { name: "Disclaimer" })).toContainText("not been independently verified");
  await expect(main.getByText(/Updated/)).toHaveCount(0);
  await expect(reader).toHaveTitle(/Rodeo grounds reopen/);

  // The author edits and adds a correction; the cached page is revalidated.
  await page.locator("html[data-hydrated]").waitFor({ state: "attached" });
  await page.getByLabel("Headline").fill("Rodeo grounds reopen Saturday");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("main").getByText("Changes saved.", { exact: true })).toBeVisible(AFTER_ACTION);
  await page.getByLabel("Add a correction").fill("The reopening is Saturday, not Friday.");
  await page.getByRole("button", { name: "Add correction" }).click();
  await expect(page.getByText("Correction added.")).toBeVisible(AFTER_ACTION);

  await expect(async () => {
    await reader.reload();
    await expect(main.getByRole("heading", { level: 1 })).toHaveText("Rodeo grounds reopen Saturday", { timeout: 1000 });
  }).toPass({ timeout: 20_000 });
  await expect(main.getByText(/Updated/)).toBeVisible();
  await expect(main.getByRole("list", { name: "Corrections" })).toContainText("The reopening is Saturday, not Friday.");
  await reader.close();
});

test("drafts and unknown stories are not found", async ({ page }) => {
  await newSignedInUser(page, "draftonly");
  await gotoReady(page, "/write");
  await page.getByLabel("Headline").fill("Secret draft");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page).toHaveURL(/\/edit\/[0-9a-f-]{36}\?notice=saved$/, AFTER_ACTION);

  const missing = await page.goto("/a/secret-draft-000000");
  expect(missing?.status()).toBe(404);
  const bad = await page.goto("/a/Not_A_Slug");
  expect(bad?.status()).toBe(404);
});
