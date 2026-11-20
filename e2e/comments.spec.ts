import { expect, test } from "@playwright/test";
import { newSignedInUser } from "./helpers/auth";
import { sql } from "./helpers/db";
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
