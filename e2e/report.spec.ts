import { expect, test } from "@playwright/test";
import { newSignedInUser } from "./helpers/auth";
import { sql, userIdByEmail } from "./helpers/db";
import { gotoReady } from "./helpers/page";
import { storyByAnotherAuthor } from "./helpers/stories";

test("readers report a story and a comment; reporting twice is explained", async ({ page }) => {
  const { slug, id, authorId } = await storyByAnotherAuthor("reported");
  const [comment] = await sql<{ id: number }[]>`
    insert into public.comments (article_id, author_id, body) values (${id}, ${authorId}, 'A comment to report') returning id`;
  const { email } = await newSignedInUser(page, "reporter");
  const me = await userIdByEmail(email);

  await gotoReady(page, `/a/${slug}`);
  await page.getByRole("button", { name: "Report this story" }).click();
  let dialog = page.getByRole("dialog", { name: "Report this story" });
  await dialog.getByRole("radio", { name: /False claims about a real person/ }).check();
  await dialog.getByLabel(/Details/).fill("Says a named neighbor stole money, with no source.");
  await dialog.getByRole("button", { name: "Send report" }).click();
  await expect(dialog.getByRole("status")).toHaveText("Thanks. A moderator will review this.");
  await dialog.getByRole("button", { name: "Done" }).click();

  const rows = await sql<{ target_type: string; reason: string; priority: string; details: string }[]>`
    select target_type::text, reason::text, priority, details from public.reports where reporter_id = ${me} and article_id = ${id}`;
  expect(rows).toEqual([
    {
      target_type: "article",
      reason: "defamation",
      priority: "high",
      details: "Says a named neighbor stole money, with no source.",
    },
  ]);

  // Again: already reported.
  await page.getByRole("button", { name: "Report this story" }).click();
  dialog = page.getByRole("dialog", { name: "Report this story" });
  await dialog.getByRole("radio", { name: /Spam/ }).check();
  await dialog.getByRole("button", { name: "Send report" }).click();
  await expect(dialog.getByRole("status")).toHaveText("You've already reported this. A moderator will review it.");
  await page.keyboard.press("Escape");

  // A comment.
  const comments = page.getByRole("region", { name: /Comments/ });
  await comments.getByRole("button", { name: "Report this comment" }).click();
  dialog = page.getByRole("dialog", { name: "Report this comment" });
  await dialog.getByRole("radio", { name: /Harassment/ }).check();
  await dialog.getByRole("button", { name: "Send report" }).click();
  await expect(dialog.getByRole("status")).toBeVisible();
  await expect
    .poll(async () => (await sql<{ n: number }[]>`select count(*)::int as n from public.reports where comment_id = ${comment!.id}`)[0]!.n)
    .toBe(1);
});

test("signed-out readers are asked to sign in to report", async ({ page }) => {
  const { slug } = await storyByAnotherAuthor("reportanon");
  await gotoReady(page, `/a/${slug}`);
  await page.getByRole("button", { name: "Report this story" }).click();
  await expect(page.getByRole("dialog").getByRole("link", { name: "Sign in to report" })).toHaveAttribute(
    "href",
    `/auth/sign-in?next=${encodeURIComponent(`/a/${slug}`)}`,
  );
});
