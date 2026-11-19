import { expect, test } from "@playwright/test";

// Uses the seeded story and writer (supabase/seed.sql).
test.describe("search", () => {
  test("finds stories by words in the story, without JavaScript-only controls", async ({ page }) => {
    await page.goto("/search");
    await expect(page.getByRole("heading", { level: 1, name: "Search" })).toBeVisible();
    await page.getByRole("searchbox", { name: "Search stories and writers" }).fill("farmers markets");
    await page.getByRole("button", { name: "Search", exact: true }).click();

    await expect(page).toHaveURL(/\/search\?q=farmers\+markets$/);
    const results = page.getByRole("region", { name: "Story results" });
    await expect(results.getByRole("link", { name: "Farmers market moves indoors for the winter" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Stories" })).toHaveAttribute("aria-current", "page");

    await results.getByRole("link", { name: "Farmers market moves indoors for the winter" }).click();
    await expect(page).toHaveURL(/\/a\/farmers-market-moves-indoors-5eed01$/);
  });

  test("finds writers by name, and says when nothing matches", async ({ page }) => {
    await page.goto("/search?q=sample");
    await page.getByRole("link", { name: "Writers" }).click();
    await expect(page).toHaveURL(/\/search\?q=sample&tab=writers$/);
    const writers = page.getByRole("region", { name: "Writer results" });
    await expect(writers.getByRole("link", { name: /Sample Writer\s*@sample_writer/ })).toBeVisible();

    // The tab is kept when searching again.
    await page.getByRole("searchbox", { name: "Search stories and writers" }).fill("zzqx-nobody");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await expect(page).toHaveURL(/tab=writers/);
    await expect(page.getByRole("main").getByRole("status")).toHaveText(/No writers match/);

    await page.goto("/search?q=zzqx-nothing");
    await expect(page.getByRole("main").getByRole("status")).toHaveText(/No stories match/);
  });
});
