import { expect, test } from "@playwright/test";
import { newSignedInUser } from "./helpers/auth";
import { sql, userIdByEmail } from "./helpers/db";
import { gotoReady } from "./helpers/page";
import { storyByAnotherAuthor } from "./helpers/stories";

test("readers save a story, find it on /saved, and remove it", async ({ page }) => {
  const { slug, id, authorId } = await storyByAnotherAuthor("saveable");
  const title = `saveable story ${authorId.slice(0, 8)}`;
  const { email } = await newSignedInUser(page, "saver");
  const me = await userIdByEmail(email);

  await gotoReady(page, "/saved");
  await expect(page.getByText("Nothing saved yet.")).toBeVisible();

  await gotoReady(page, `/a/${slug}`);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("button", { name: "Saved" })).toHaveAttribute("aria-pressed", "true");
  await expect
    .poll(async () => (await sql<{ n: number }[]>`select count(*)::int as n from public.bookmarks where user_id = ${me} and article_id = ${id}`)[0]!.n)
    .toBe(1);

  await gotoReady(page, "/saved");
  await expect(page.getByRole("link", { name: title })).toBeVisible();

  // Still saved after a reload; unsave from the story page.
  await gotoReady(page, `/a/${slug}`);
  await page.getByRole("button", { name: "Saved" }).click();
  await expect(page.getByRole("button", { name: "Save", exact: true })).toBeVisible();
  await expect
    .poll(async () => (await sql<{ n: number }[]>`select count(*)::int as n from public.bookmarks where user_id = ${me}`)[0]!.n)
    .toBe(0);
  await gotoReady(page, "/saved");
  await expect(page.getByText("Nothing saved yet.")).toBeVisible();
});

test("signed-out readers are asked to sign in to save", async ({ page }) => {
  const { slug } = await storyByAnotherAuthor("saveanon");
  await page.goto(`/a/${slug}`);
  await expect(page.getByRole("link", { name: "Sign in to save" })).toHaveAttribute("href", `/auth/sign-in?next=/a/${slug}`);
  await page.goto("/saved");
  await expect(page.getByRole("main").getByRole("link", { name: "Sign in", exact: true })).toHaveAttribute(
    "href",
    "/auth/sign-in?next=/saved",
  );
});
