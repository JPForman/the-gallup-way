import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { newSignedInUser } from "./helpers/auth";
import { ACCEPTED_SIGNUP, sql } from "./helpers/db";
import { gotoReady } from "./helpers/page";
import { storyByAnotherAuthor } from "./helpers/stories";

test("readers comment, reply and delete their own comments", async ({ page, browser }) => {
  test.slow();
  const { slug, id } = await storyByAnotherAuthor("commented");

  const anon = await browser.newPage();
  await anon.goto(`/a/${slug}`);
  const anonComments = anon.getByRole("region", { name: /Comments/ });
  await expect(anonComments.getByRole("link", { name: "Sign in to comment" })).toHaveAttribute(
    "href",
    `/auth/sign-in?next=/a/${slug}`,
  );
  await expect(anonComments.getByText("No comments yet.")).toBeVisible();
  await anon.close();

  await newSignedInUser(page, "commenter");
  await gotoReady(page, `/a/${slug}`);
  const comments = page.getByRole("region", { name: /Comments/ });

  // Blank comments are caught before sending.
  await comments.getByRole("button", { name: "Post comment" }).click();
  await expect(comments.getByRole("alert")).toHaveText("Write something first.");

  await comments.getByLabel("Add a comment").fill("Great to see this.\nSecond line.");
  await comments.getByRole("button", { name: "Post comment" }).click();
  await expect(comments.getByText(/Great to see this\.\s*Second line\./)).toBeVisible();
  await expect(comments.getByRole("heading", { name: "Comments (1)" })).toBeVisible();
  await expect(comments.getByLabel("Add a comment")).toHaveValue("");

  // Reply (one level).
  await comments.getByRole("button", { name: "Reply" }).click();
  await comments.getByLabel(/Reply to/).fill("Replying to myself.");
  await comments.getByRole("button", { name: "Post reply" }).click();
  const replies = comments.getByRole("list", { name: /Replies to/ });
  await expect(replies.getByText("Replying to myself.")).toBeVisible();
  await expect(comments.getByRole("heading", { name: "Comments (2)" })).toBeVisible();

  // Delete the top-level comment: its text goes, the reply stays.
  await comments.getByRole("button", { name: "Delete" }).first().click();
  await comments.getByRole("button", { name: "Yes, delete" }).click();
  await expect(comments.getByText("Comment deleted.")).toBeVisible();
  await expect(comments.getByText(/Great to see this/)).toHaveCount(0);
  await expect(replies.getByText("Replying to myself.")).toBeVisible();
  await expect(comments.getByRole("heading", { name: "Comments (1)" })).toBeVisible();

  const rows = await sql<{ body: string; deleted: boolean }[]>`
    select body, deleted_at is not null as deleted from public.comments where article_id = ${id} order by id`;
  expect(rows).toEqual([
    { body: "", deleted: true },
    { body: "Replying to myself.", deleted: false },
  ]);
});

test("locked stories show that comments are closed", async ({ page }) => {
  const { slug, id } = await storyByAnotherAuthor("locked");
  await sql`update public.articles set comments_locked = true where id = ${id}`;
  await newSignedInUser(page, "lockedreader");
  await gotoReady(page, `/a/${slug}`);
  const comments = page.getByRole("region", { name: /Comments/ });
  await expect(comments.getByText("Comments are closed on this story.")).toBeVisible();
  await expect(comments.getByLabel("Add a comment")).toHaveCount(0);
});

test("comments removed by a moderator show a placeholder and keep their replies", async ({ page }) => {
  const { slug, id, authorId } = await storyByAnotherAuthor("modremoved");
  const modId = randomUUID();
  await sql`insert into auth.users (id, email, raw_user_meta_data) values (${modId}, ${`mod-${modId.slice(0, 8)}@example.invalid`},
    ${sql.json({ handle: `mod_${modId.slice(0, 8)}`, display_name: "Moderator", ...ACCEPTED_SIGNUP })})`;
  await sql`update public.profiles set role = 'moderator' where id = ${modId}`;
  const [top] = await sql<{ id: number }[]>`
    insert into public.comments (article_id, author_id, body) values (${id}, ${authorId}, 'Something rude') returning id`;
  await sql`insert into public.comments (article_id, author_id, parent_id, body) values (${id}, ${authorId}, ${top!.id}, 'A reply that stays')`;

  // The real staff function, called as the moderator.
  await sql.begin(async (tx) => {
    await tx`select set_config('request.jwt.claims', ${JSON.stringify({ sub: modId, role: "authenticated" })}, true)`;
    await tx`select public.staff_comment_action(${top!.id}, 'remove', 'Personal attack')`;
  });

  await page.goto(`/a/${slug}`);
  const comments = page.getByRole("region", { name: /Comments/ });
  await expect(comments.getByText("Removed by a moderator.")).toBeVisible();
  await expect(comments.getByText("Something rude")).toHaveCount(0);
  await expect(comments.getByText("A reply that stays")).toBeVisible();
});
