import { expect, test } from "@playwright/test";
import { newSignedInUser } from "./helpers/auth";
import { sql, userIdByEmail } from "./helpers/db";
import { gotoReady } from "./helpers/page";
import { storyByAnotherAuthor } from "./helpers/stories";

test("readers follow a writer, see their stories on /following, and unfollow", async ({ page }) => {
  const { slug, authorId, authorHandle } = await storyByAnotherAuthor("followable");
  const title = `followable story ${authorId.slice(0, 8)}`;

  const { email } = await newSignedInUser(page, "follower");
  const me = await userIdByEmail(email);

  await gotoReady(page, "/following");
  await expect(page.getByText("Nothing here yet.")).toBeVisible();

  // Follow from the story page.
  await gotoReady(page, `/a/${slug}`);
  await page.getByRole("button", { name: "Follow Story Author" }).click();
  await expect(page.getByRole("button", { name: "Following Story Author" })).toHaveAttribute("aria-pressed", "true");
  await expect
    .poll(async () => (await sql<{ n: number }[]>`select count(*)::int as n from public.follows where follower_id = ${me} and followee_id = ${authorId}`)[0]!.n)
    .toBe(1);

  await gotoReady(page, "/following");
  await expect(page.getByRole("link", { name: title })).toBeVisible();

  // Counts and unfollow on the profile page.
  await gotoReady(page, `/u/${authorHandle}`);
  await expect(page.getByText("1 follower · 0 following")).toBeVisible();
  await page.getByRole("button", { name: "Following Story Author" }).click();
  await expect(page.getByRole("button", { name: "Follow Story Author" })).toBeVisible();
  await expect(page.getByText("0 followers · 0 following")).toBeVisible();

  await gotoReady(page, "/following");
  await expect(page.getByText("Nothing here yet.")).toBeVisible();
});

test("signed-out readers are asked to sign in; nobody can follow themselves", async ({ page, browser }) => {
  const { slug } = await storyByAnotherAuthor("followanon");
  const anon = await browser.newPage();
  await anon.goto("/following");
  await expect(anon.getByRole("main").getByRole("link", { name: "Sign in", exact: true })).toHaveAttribute("href", "/auth/sign-in?next=/following");
  await anon.goto(`/a/${slug}`);
  await expect(anon.getByRole("link", { name: "Sign in to follow" })).toBeVisible();
  await anon.close();

  const { handle } = await newSignedInUser(page, "selffollow");
  await gotoReady(page, `/u/${handle}`);
  await expect(page.getByText("0 followers · 0 following")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Follow/ })).toHaveCount(0);
});
