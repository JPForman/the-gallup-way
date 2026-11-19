import type { Page } from "@playwright/test";

/** Navigate and wait until React has hydrated, so forms submit through React. */
export async function gotoReady(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await page.locator("html[data-hydrated]").waitFor({ state: "attached" });
}
