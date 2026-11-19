import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { newSignedInUser } from "./helpers/auth";
import { sql, userIdByEmail } from "./helpers/db";
import { gotoReady } from "./helpers/page";

const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

test.describe("writing stories", () => {
  test("draft with formatting, a source and a photo; then delete it", async ({ page }) => {
    test.slow();
    await newSignedInUser(page, "writer");

    await gotoReady(page, "/write");
    await expect(page.getByRole("heading", { level: 1, name: "Write a story" })).toBeVisible();
    const editor = page.getByRole("textbox", { name: "Story" });
    await expect(editor).toBeVisible();
    const axe = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
    expect(axe.violations).toEqual([]);

    await page.getByLabel("Headline").fill("County fair opens Friday");
    await page.getByLabel("Summary (optional)").fill("Rides, rodeo and fry bread all weekend.");
    await page.getByLabel("Category").selectOption("events");
    await page.getByLabel("Story type").selectOption("event");
    await editor.click();
    await page.keyboard.type("Gates open at nine. ");
    await page.getByRole("button", { name: "Bold", exact: true }).click();
    await page.keyboard.type("Parking is free.");

    await page.getByRole("button", { name: "Add a source" }).click();
    await page.getByLabel("Web address").fill("https://example.com/fair");
    await page.getByLabel("Label (optional)").fill("Fair board schedule");

    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByRole("main").getByRole("status")).toHaveText("Draft saved. You can add photos now.", { timeout: 30_000 });
    await expect(page).toHaveURL(/\/edit\/[0-9a-f-]{36}\?notice=saved$/, { timeout: 30_000 });
    await page.locator("html[data-hydrated]").waitFor({ state: "attached" });

    // Photo
    await page.getByLabel("Choose a photo").setInputFiles("e2e/fixtures/avatar.png");
    await expect(page.getByText("Photo 1", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByRole("main").getByRole("alert")).toHaveText("Please fix the highlighted fields.");
    await expect(page.getByText("Photo 1: describe the photo")).toBeVisible();
    await expect(page.getByLabel("Headline")).toHaveValue("County fair opens Friday");

    await page.getByLabel("Description (for screen readers)").fill("Ferris wheel at dusk");
    await page.getByLabel("Photo credit (optional)").fill("Test Resident");
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByRole("main").getByRole("status")).toHaveText("Draft saved.");

    // Everything persisted.
    await page.reload();
    await page.locator("html[data-hydrated]").waitFor({ state: "attached" });
    await expect(page.getByLabel("Headline")).toHaveValue("County fair opens Friday");
    await expect(page.getByLabel("Category")).toHaveValue("events");
    await expect(editor.locator("strong")).toHaveText("Parking is free.");
    await expect(page.getByLabel("Web address")).toHaveValue("https://example.com/fair");
    await expect(page.getByLabel("Description (for screen readers)")).toHaveValue("Ferris wheel at dusk");
    const src = await page.getByRole("main").locator("fieldset img").getAttribute("src");
    expect(src).toMatch(/\/storage\/v1\/object\/public\/article-images\/.+\.webp$/);
    expect((await page.request.get(src!)).status()).toBe(200);
    const axeEdit = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
    expect(axeEdit.violations).toEqual([]);

    // Listed on /write
    await gotoReady(page, "/write");
    await expect(page.getByRole("link", { name: /County fair opens Friday\s*Draft/ })).toBeVisible();

    // Delete
    await page.getByRole("link", { name: /County fair opens Friday/ }).click();
    await page.locator("html[data-hydrated]").waitFor({ state: "attached" });
    await page.getByRole("button", { name: "Delete draft" }).click();
    await page.getByRole("button", { name: "Yes, delete it" }).click();
    await expect(page).toHaveURL(/\/write\?deleted=1$/);
    await expect(page.getByRole("main").getByRole("status")).toHaveText("Draft deleted.");
    await expect(page.getByRole("link", { name: /County fair opens Friday/ })).toHaveCount(0);
    expect((await page.request.get(src!)).status()).not.toBe(200);
  });

  test("invalid source keeps what you typed", async ({ page }) => {
    await newSignedInUser(page, "badsource");
    await gotoReady(page, "/write");
    await page.getByLabel("Headline").fill("Road work on Route 66");
    await page.getByRole("button", { name: "Add a source" }).click();
    await page.getByLabel("Web address").fill("javascript:alert(1)");
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByRole("main").getByRole("alert")).toHaveText("Please fix the highlighted fields.");
    await expect(page.getByText("Source 1: enter a full web address")).toBeVisible();
    await expect(page.getByLabel("Headline")).toHaveValue("Road work on Route 66");
    await expect(page).toHaveURL(/\/write$/);
  });

  test("suspended writers see a notice instead of the editor", async ({ page }) => {
    const { email } = await newSignedInUser(page, "suswriter");
    const id = await userIdByEmail(email);
    await sql`update public.profiles set suspended_until = now() + interval '3 days' where id = ${id}`;
    await gotoReady(page, "/write");
    await expect(page.getByRole("main").getByRole("status")).toContainText("Your account is suspended");
    await expect(page.getByRole("textbox", { name: "Story" })).toHaveCount(0);
  });

  test("signed-out visitors are sent to sign in; unknown drafts are 404", async ({ page }) => {
    await page.goto("/write");
    await expect(page).toHaveURL(/\/auth\/sign-in\?next=(%2F|\/)write$/);
    await newSignedInUser(page, "nodraft");
    expect((await page.goto("/edit/00000000-0000-4000-8000-000000000000"))?.status()).toBe(404);
    expect((await page.goto("/edit/not-a-uuid"))?.status()).toBe(404);
  });
});
