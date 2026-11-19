import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { newSignedInUser } from "./helpers/auth";
import { sql, userIdByEmail } from "./helpers/db";
import { gotoReady } from "./helpers/page";

test.describe("profiles and settings", () => {
  test("edit profile with a photo, and see it on the public profile", async ({ page }) => {
    test.slow();
    const { handle } = await newSignedInUser(page, "profile");

    // /me goes to your own profile, which offers "Edit profile".
    await gotoReady(page, "/me");
    await expect(page).toHaveURL(new RegExp(`/u/${handle}$`));
    await expect(page.getByRole("heading", { level: 1, name: "Test Resident" })).toBeVisible();
    await page.getByRole("link", { name: "Edit profile" }).click();
    await expect(page).toHaveURL(/\/settings$/);
    await page.locator("html[data-hydrated]").waitFor({ state: "attached" });

    const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(axe.violations).toEqual([]);

    await page.getByLabel("Choose a profile photo").setInputFiles("e2e/fixtures/avatar.png");
    await expect(page.getByRole("button", { name: "Change photo" })).toBeVisible();
    await page.getByLabel("Name").fill("Jo Begay");
    await page.getByLabel("Bio").fill("Gallup native. I cover school board meetings.");
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(page.getByRole("main").getByRole("status")).toHaveText("Profile saved.");

    await gotoReady(page, `/u/${handle}`);
    await expect(page.getByRole("heading", { level: 1, name: "Jo Begay" })).toBeVisible();
    await expect(page.getByText("I cover school board meetings.")).toBeVisible();
    const img = page.getByRole("main").locator("header img");
    await expect(img).toHaveAttribute("src", /\/storage\/v1\/object\/public\/avatars\/.+\.webp$/);
    const res = await page.request.get((await img.getAttribute("src"))!);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toBe("image/webp");
  });

  test("changing your handle moves your profile", async ({ page }) => {
    const { handle } = await newSignedInUser(page, "rehandle");
    const newHandle = `${handle.slice(0, 24)}_new`;
    await gotoReady(page, "/settings");
    await page.getByLabel("Handle").fill(newHandle);
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(page.getByRole("main").getByRole("status")).toHaveText("Profile saved.");

    expect((await page.goto(`/u/${newHandle}`))?.status()).toBe(200);
    expect((await page.goto(`/u/${handle}`))?.status()).toBe(404);
  });

  test("signed-out visitors are sent to sign in", async ({ page }) => {
    await page.goto("/settings");
    await expect(page).toHaveURL(/\/auth\/sign-in\?next=(%2F|\/)settings$/);
    await page.goto("/me");
    await expect(page).toHaveURL(/\/auth\/sign-in\?next=(%2F|\/)me$/);
  });

  test("unknown profile is a 404", async ({ page }) => {
    expect((await page.goto("/u/no_such_person_here"))?.status()).toBe(404);
  });

  test("a user who owes a re-accept sees the banner and can accept", async ({ page }) => {
    const { email } = await newSignedInUser(page, "reaccept");
    const id = await userIdByEmail(email);
    // Simulate a Terms update for this user only.
    await sql`delete from public.agreement_acceptances where user_id = ${id} and kind = 'terms'`;

    await gotoReady(page, "/legal/guidelines");
    const banner = page.getByRole("status").filter({ hasText: "updated our Terms" });
    await expect(banner).toBeVisible();
    await banner.getByRole("link", { name: "Review and accept" }).click();
    await expect(page).toHaveURL(/\/account\/agreements\?next=%2Flegal%2Fguidelines$/);
    await page.locator("html[data-hydrated]").waitFor({ state: "attached" });

    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("Please confirm you agree to continue.")).toBeVisible();
    await page.getByLabel(/I agree to the current/).check();
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page).toHaveURL(/\/legal\/guidelines$/);
    await expect(banner).toBeHidden();
    const rows = await sql`select 1 from public.agreement_acceptances where user_id = ${id} and kind = 'terms'`;
    expect(rows.length).toBe(1);
  });

  test("a suspended user sees a notice and can't change their profile", async ({ page }) => {
    const { email } = await newSignedInUser(page, "suspended");
    const id = await userIdByEmail(email);
    await sql`update public.profiles set suspended_until = now() + interval '3 days' where id = ${id}`;

    await gotoReady(page, "/settings");
    await expect(page.getByRole("status").filter({ hasText: "Your account is suspended" })).toBeVisible();
    await page.getByLabel("Bio").fill("spam spam spam");
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(page.getByRole("main").getByRole("alert")).toContainText("suspended");
  });
});
