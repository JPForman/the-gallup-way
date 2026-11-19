import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { newSignedInUser } from "./helpers/auth";
import { sql, userIdByEmail } from "./helpers/db";
import { gotoReady } from "./helpers/page";

const AFTER_ACTION = { timeout: 30_000 };
const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

test("editing a published story keeps a revision, and the author can add a correction", async ({ page }) => {
  test.slow();
  const { email } = await newSignedInUser(page, "corrector");
  await sql`update public.profiles set approved_article_count = 3 where id = ${await userIdByEmail(email)}`;

  // Publish a story.
  await gotoReady(page, "/write");
  await page.getByLabel("Headline").fill("Fair opens Thursday");
  await page.getByLabel("Category").selectOption("events");
  await page.getByRole("textbox", { name: "Story" }).click();
  await page.keyboard.type("The county fair opens Thursday at nine.");
  await page.getByLabel(/I agree to the Contributor Agreement/).check();
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(page).toHaveURL(/\?notice=published$/, AFTER_ACTION);
  const id = page.url().match(/\/edit\/([0-9a-f-]{36})/)![1]!;

  // Published stories get a Corrections section.
  await expect(page.getByRole("heading", { name: "Corrections" })).toBeVisible();

  // Edit the headline: the old version is kept as a revision.
  await page.locator("html[data-hydrated]").waitFor({ state: "attached" });
  await page.getByLabel("Headline").fill("Fair opens Friday");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("main").getByText("Changes saved.", { exact: true })).toBeVisible(AFTER_ACTION);
  const revisions = await sql<{ title: string }[]>`
    select title from public.article_revisions where article_id = ${id}`;
  expect(revisions.map((r) => r.title)).toEqual(["Fair opens Thursday"]);

  // A blank correction is rejected.
  const correction = page.getByLabel("Add a correction");
  await page.getByRole("button", { name: "Add correction" }).click();
  await expect(page.getByText("Describe what was wrong and what's correct.")).toBeVisible();

  // Add a correction; it's listed with today's date and the box is cleared.
  await correction.fill("An earlier version said the fair opens Thursday. It opens Friday.");
  await page.getByRole("button", { name: "Add correction" }).click();
  await expect(page.getByText("Correction added.")).toBeVisible(AFTER_ACTION);
  const list = page.getByRole("list", { name: "Corrections" });
  await expect(list.getByRole("listitem")).toHaveCount(1);
  await expect(list).toContainText("An earlier version said the fair opens Thursday. It opens Friday.");
  await expect(list).toContainText(/Correction, \w+ \d{1,2}, \d{4}/);
  await expect(correction).toHaveValue("");

  const axe = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  expect(axe.violations).toEqual([]);
});
