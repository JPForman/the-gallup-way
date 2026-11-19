import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { newSignedInUser } from "./helpers/auth";
import { sql, userIdByEmail } from "./helpers/db";
import { gotoReady } from "./helpers/page";

/** A published story by a separate (password-less) author, unique to this test. */
async function storyByAnotherAuthor() {
  const authorId = randomUUID();
  const tag = authorId.slice(0, 8);
  await sql`insert into auth.users (id, email, raw_user_meta_data) values (${authorId}, ${`author-${tag}@example.invalid`},
    ${sql.json({ handle: `author_${tag}`, display_name: "Like Author", age_confirmed: true, accepted_terms_version: 1, accepted_privacy_version: 1 })})`;
  const slug = `likeable-${tag}`;
  const [row] = await sql<{ id: string }[]>`
    insert into public.articles (author_id, slug, title, category, body_json, status, submitted_at, published_at)
    values (${authorId}, ${slug}, ${`Likeable story ${tag}`}, 'community',
      '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Like me."}]}]}',
      'published', now(), now())
    returning id`;
  return { slug, id: row!.id };
}

test("readers like and unlike a story; signed-out readers are asked to sign in", async ({ page, browser }) => {
  const { slug, id } = await storyByAnotherAuthor();

  const anon = await browser.newPage();
  await anon.goto(`/a/${slug}`);
  await expect(anon.getByRole("link", { name: "Sign in to like" })).toHaveAttribute("href", `/auth/sign-in?next=/a/${slug}`);
  await expect(anon.getByText("0 likes")).toBeVisible();
  await anon.close();

  await newSignedInUser(page, "liker");
  await gotoReady(page, `/a/${slug}`);
  const like = page.getByRole("button", { name: "Like", exact: true });
  await expect(like).toHaveAttribute("aria-pressed", "false");
  await like.click();
  await expect(page.getByRole("button", { name: "Liked" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("1 like", { exact: true })).toBeVisible();
  await expect
    .poll(async () => (await sql<{ n: number }[]>`select count(*)::int as n from public.reactions where article_id = ${id}`)[0]!.n)
    .toBe(1);

  // Still liked after a reload (the page is cached; state comes from the database).
  await gotoReady(page, `/a/${slug}`);
  await expect(page.getByRole("button", { name: "Liked" })).toBeVisible();
  await page.getByRole("button", { name: "Liked" }).click();
  await expect(page.getByRole("button", { name: "Like", exact: true })).toBeVisible();
  await expect(page.getByText("0 likes")).toBeVisible();
  await expect
    .poll(async () => (await sql<{ n: number }[]>`select count(*)::int as n from public.reactions where article_id = ${id}`)[0]!.n)
    .toBe(0);
});

test("authors see the count but no like button on their own story", async ({ page }) => {
  const { email } = await newSignedInUser(page, "selflike");
  // Publishing directly needs 3 approved stories.
  await sql`update public.profiles set approved_article_count = 3 where id = ${await userIdByEmail(email)}`;
  await gotoReady(page, "/write");
  await page.getByLabel("Headline").fill("My own likeable story");
  await page.getByLabel("Category").selectOption("community");
  await page.getByRole("textbox", { name: "Story" }).click();
  await page.keyboard.type("Can I like my own story?");
  await page.getByLabel(/I agree to the Contributor Agreement/).check();
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(page).toHaveURL(/\?notice=published$/, { timeout: 30_000 });

  await page.getByRole("link", { name: "View story" }).click();
  await expect(page.getByText("0 likes")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Like/ })).toHaveCount(0);
});
