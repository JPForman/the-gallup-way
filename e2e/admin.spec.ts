import { expect, test } from "@playwright/test";
import { newSignedInUser } from "./helpers/auth";
import { ACCEPTED_SIGNUP, sql, userIdByEmail } from "./helpers/db";
import { gotoReady } from "./helpers/page";
import { storyByAnotherAuthor } from "./helpers/stories";

// Admin pages show global queues; run on one project so tests don't see each other's rows mid-action.
test.describe.configure({ mode: "serial" });

test("non-staff get a 404 at /admin", async ({ page, isMobile }) => {
  test.skip(isMobile, "desktop only");
  const anon = await page.goto("/admin");
  expect(anon?.status()).toBe(404);
  await newSignedInUser(page, "notstaff");
  const res = await page.goto("/admin");
  expect(res?.status()).toBe(404);
});

test("moderators work the report queue: hide a reported story, remove a comment", async ({ page, isMobile }) => {
  test.skip(isMobile, "desktop only");
  test.slow();
  const { slug, id, authorId } = await storyByAnotherAuthor("queued");
  const title = `queued story ${authorId.slice(0, 8)}`;
  const reporter = randomReporter();
  await sql`insert into auth.users (id, email, raw_user_meta_data) values (${reporter.id}, ${reporter.email}, ${sql.json(reporter.meta)})`;
  const commentText = `Queue this comment ${authorId.slice(0, 8)}`;
  const [comment] = await sql<{ id: number }[]>`
    insert into public.comments (article_id, author_id, body) values (${id}, ${authorId}, ${commentText}) returning id`;
  await sql`insert into public.reports (reporter_id, target_type, article_id, reason, details)
            values (${reporter.id}, 'article', ${id}, 'defamation', 'Accuses a neighbor')`;
  await sql`insert into public.reports (reporter_id, target_type, comment_id, reason)
            values (${reporter.id}, 'comment', ${comment!.id}, 'harassment')`;

  const { email } = await newSignedInUser(page, "moderator");
  await sql`update public.profiles set role = 'moderator' where id = ${await userIdByEmail(email)}`;

  await gotoReady(page, "/settings");
  await page.getByRole("link", { name: "Open the admin dashboard" }).click();
  await expect(page.getByRole("heading", { name: "Admin", level: 1 })).toBeVisible();

  // The story report is in the queue, high priority.
  const queue = page.getByRole("region", { name: "Reports" });
  const storyItem = queue.getByRole("listitem").filter({ hasText: title });
  await expect(storyItem.getByText("High priority")).toBeVisible();
  await expect(storyItem.getByText("Accuses a neighbor")).toBeVisible();

  // Review → hide with a reason.
  await storyItem.getByRole("link", { name: "Review story" }).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await gotoReady(page, page.url());
  // A reason is required (the browser blocks an empty one; the server and DB check too).
  await expect(page.getByLabel("Reason (goes in the moderation log)")).toHaveAttribute("required", "");
  await page.getByLabel("Reason (goes in the moderation log)").fill("Unsupported allegation about a private person");
  await page.getByRole("button", { name: "Hide story" }).click();
  await expect(page.getByRole("status")).toHaveText("Story hidden.");
  await expect(page.getByRole("button", { name: "Restore story" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Staff history" }).getByText("Unsupported allegation about a private person")).toBeVisible();

  // Gone from the public site and the queue.
  const res = await page.request.get(`/a/${slug}`);
  expect(res.status()).toBe(404);
  await gotoReady(page, "/admin");
  await expect(queue.getByText(title)).toHaveCount(0);

  // Remove the reported comment straight from the queue.
  const commentItem = queue.getByRole("listitem").filter({ hasText: commentText });
  await commentItem.getByLabel("Reason (goes in the moderation log)").fill("Personal attack");
  await commentItem.getByRole("button", { name: "Remove comment" }).click();
  // Removing resolves its reports, so the item leaves the queue.
  await expect(commentItem).toHaveCount(0);
  const [row] = await sql<{ removed: boolean }[]>`select removed_at is not null as removed from public.comments where id = ${comment!.id}`;
  expect(row!.removed).toBe(true);

  // Both actions are in the log.
  await gotoReady(page, "/admin?tab=log");
  const log = page.getByRole("region", { name: "Log" });
  await expect(log.getByRole("listitem").filter({ hasText: "Hid story" }).filter({ hasText: title })).toHaveCount(1);
  await expect(log.getByRole("listitem").filter({ hasText: "Removed comment" }).filter({ hasText: title })).toHaveCount(1);
});

test("moderators approve a pending story", async ({ page, isMobile }) => {
  test.skip(isMobile, "desktop only");
  const { id, authorId } = await storyByAnotherAuthor("pendingok");
  await sql`update public.articles set status = 'pending_review', published_at = null where id = ${id}`;
  const title = `pendingok story ${authorId.slice(0, 8)}`;
  const { email } = await newSignedInUser(page, "approver");
  await sql`update public.profiles set role = 'moderator' where id = ${await userIdByEmail(email)}`;

  await gotoReady(page, "/admin?tab=pending");
  const item = page.getByRole("region", { name: "Pending review" }).getByRole("listitem").filter({ hasText: title });
  await item.getByRole("link", { name: "Review" }).click();
  await page.waitForURL(`**/admin/articles/${id}`);
  await gotoReady(page, page.url());
  await page.getByLabel("Reason (goes in the moderation log)").fill("Clear and sourced");
  await page.getByRole("button", { name: "Approve and publish" }).click();
  await expect(page.getByRole("status")).toHaveText("Story approved and published.");
  const [row] = await sql<{ status: string }[]>`select status::text from public.articles where id = ${id}`;
  expect(row!.status).toBe("published");
});

function randomReporter() {
  const id = crypto.randomUUID();
  const tag = id.slice(0, 8);
  return {
    id,
    email: `reporter-${tag}@example.invalid`,
    meta: { handle: `rep_${tag}`, display_name: "Reporter", ...ACCEPTED_SIGNUP },
  };
}
