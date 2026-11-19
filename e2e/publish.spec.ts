import { expect, test, type Page } from "@playwright/test";
import { newSignedInUser } from "./helpers/auth";
import { sql, userIdByEmail } from "./helpers/db";
import { gotoReady } from "./helpers/page";

async function fillStory(page: Page, title: string) {
  await page.getByLabel("Headline").fill(title);
  await page.getByLabel("Category").selectOption("community");
  await page.getByRole("textbox", { name: "Story" }).click();
  await page.keyboard.type("The library is extending its hours through December.");
}

/** Redirecting actions (save + agree + submit) can be slow on a cold dev server. */
const AFTER_ACTION = { timeout: 30_000 };

const agreement = (page: Page) => page.getByLabel(/I agree to the Contributor Agreement/);

test.describe("publishing", () => {
  test("a new contributor's story goes to review, and can be withdrawn", async ({ page }) => {
    test.slow();
    const { email } = await newSignedInUser(page, "newwriter");
    await gotoReady(page, "/write");
    await expect(page.getByText("You have 0 of 3 approved.")).toBeVisible();

    await fillStory(page, "Library hours extended");
    await agreement(page).check();
    await page.getByRole("button", { name: "Submit for review" }).click();

    await expect(page.getByRole("main").getByRole("status").first()).toContainText("Sent for review.", AFTER_ACTION);
    await expect(page).toHaveURL(/\/edit\/[0-9a-f-]{36}\?notice=review$/, AFTER_ACTION);
    await expect(page.getByText("Waiting for review.", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Submit for review" })).toHaveCount(0);

    // The acceptance was recorded for this story, at the current version.
    const id = page.url().match(/\/edit\/([0-9a-f-]{36})/)![1]!;
    const rows = await sql<{ n: number }[]>`
      select count(*)::int as n from public.agreement_acceptances
      where article_id = ${id} and kind = 'contributor' and version = 1
        and user_id = ${await userIdByEmail(email)}`;
    expect(rows[0]!.n).toBe(1);

    await page.locator("html[data-hydrated]").waitFor({ state: "attached" });
    await page.getByRole("button", { name: "Withdraw from review" }).click();
    await expect(page).toHaveURL(/\?notice=withdrawn$/, AFTER_ACTION);
    await expect(page.getByRole("main").getByRole("status").first()).toContainText("Withdrawn from review.", AFTER_ACTION);
    await expect(page.getByRole("button", { name: "Submit for review" })).toBeVisible();

    await gotoReady(page, "/write");
    await expect(page.getByRole("link", { name: /Library hours extended\s*Draft/ })).toBeVisible();
  });

  test("publishing needs a complete story and the agreement; Enter doesn't publish", async ({ page }) => {
    await newSignedInUser(page, "notready");
    await gotoReady(page, "/write");
    await page.getByLabel("Headline").fill("Hi");
    await page.getByLabel("Headline").press("Enter");
    await expect(page).toHaveURL(/\/write$/);
    await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);

    await page.getByRole("button", { name: "Submit for review" }).click();
    await expect(page.getByRole("main").getByRole("alert")).toHaveText("Your story isn't ready to publish yet.");
    await expect(page.getByText("Add a headline of at least 5 characters to publish.")).toBeVisible();
    await expect(page.getByText("Choose a category to publish.")).toBeVisible();
    await expect(page.getByText("Write the story before publishing.")).toBeVisible();
    await expect(page.getByText("Agree to the Contributor Agreement to publish.")).toBeVisible();
    await expect(page).toHaveURL(/\/write$/);
  });

  test("a contributor with 3 approved stories publishes directly", async ({ page }) => {
    const { email } = await newSignedInUser(page, "veteran");
    await sql`update public.profiles set approved_article_count = 3 where id = ${await userIdByEmail(email)}`;

    await gotoReady(page, "/write");
    await expect(page.getByText("Your story will appear on the site as soon as you publish it.")).toBeVisible();
    await fillStory(page, "Route 66 cleanup this Saturday");
    await agreement(page).check();
    await page.getByRole("button", { name: "Publish", exact: true }).click();

    await expect(page.getByRole("main").getByRole("status").first()).toContainText("Published.", AFTER_ACTION);
    await expect(page).toHaveURL(/\?notice=published$/, AFTER_ACTION);
    await expect(page.getByRole("link", { name: "View story" })).toHaveAttribute(
      "href",
      /^\/a\/route-66-cleanup-this-saturday-[0-9a-f]{6}$/,
    );
    await expect(page.getByRole("button", { name: "Save changes" })).toBeVisible();
  });
});
