import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("layout shell", () => {
  test("home shows the masthead and community-board disclaimer", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle("The Gallup Way");
    await expect(page.getByRole("link", { name: "The Gallup Way", exact: true })).toBeVisible();
    await expect(page.getByRole("contentinfo")).toContainText("Stories are posted by community members");
  });

  test("footer links reach the legal pages", async ({ page }) => {
    await page.goto("/");
    const legal = page.getByRole("navigation", { name: "Legal" });
    await legal.getByRole("link", { name: "Community Guidelines" }).click();
    await expect(page).toHaveURL(/\/legal\/guidelines$/);
    await expect(page.getByRole("heading", { level: 1, name: "Community Guidelines" })).toBeVisible();
  });

  test("unknown legal page is a 404", async ({ page }) => {
    const res = await page.goto("/legal/not-a-page");
    expect(res?.status()).toBe(404);
  });

  test("primary navigation matches the viewport", async ({ page, isMobile }) => {
    await page.goto("/");
    const bottomNav = page.getByRole("navigation", { name: "Primary" });
    if (isMobile) {
      await expect(bottomNav).toBeVisible();
      await expect(bottomNav.getByRole("link", { name: "Write" })).toBeVisible();
    } else {
      await expect(bottomNav).toBeHidden();
      await expect(page.getByRole("link", { name: "Write a story" })).toBeVisible();
    }
  });

  test("dark mode toggle switches the theme", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/");
    const html = page.locator("html");
    await expect(html).not.toHaveClass(/dark/);
    await page.getByRole("button", { name: "Toggle dark mode" }).click();
    await expect(html).toHaveClass(/dark/);
  });
});

test.describe("accessibility", () => {
  for (const path of [
    "/",
    "/legal/terms",
    "/contact",
    "/auth/sign-up",
    "/auth/sign-in",
    "/auth/forgot-password",
    "/a/farmers-market-moves-indoors-5eed01", // seeded story (supabase/seed.sql)
  ]) {
    for (const scheme of ["light", "dark"] as const) {
      test(`${path} has no axe violations (${scheme})`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: scheme });
        await page.goto(path);
        const results = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
          .analyze();
        expect(results.violations).toEqual([]);
      });
    }
  }
});
