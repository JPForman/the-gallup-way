import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { newSignedInUser, PASSWORD } from "./helpers/auth";
import { sql, userIdByEmail } from "./helpers/db";
import { gotoReady } from "./helpers/page";

const BODY = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Story text." }] }] };

async function story(authorId: string, published: boolean) {
  const tag = randomUUID().slice(0, 8);
  const slug = `leaving-${tag}`;
  const [row] = await sql<{ id: string }[]>`
    insert into public.articles (author_id, slug, title, category, body_json, status, submitted_at, published_at)
    values (${authorId}, ${published ? slug : null}, ${`Leaving story ${tag}`}, 'community', ${sql.json(BODY)},
      ${published ? "published" : "draft"}, ${published ? new Date() : null}, ${published ? new Date() : null})
    returning id`;
  return { id: row!.id, slug, title: `Leaving story ${tag}` };
}

test("members delete their account and keep published stories as a former member", async ({ page }) => {
  const { email, handle } = await newSignedInUser(page, "leaver");
  const me = await userIdByEmail(email);
  const kept = await story(me, true);
  const draft = await story(me, false);

  await gotoReady(page, "/settings");
  await page.getByRole("button", { name: "Delete my account…" }).click();
  // Wrong password and missing confirmation are caught.
  await page.getByLabel("Your password").fill("not my password");
  await page.getByRole("button", { name: "Delete my account" }).click();
  await expect(page.getByText("Type DELETE to confirm.")).toBeVisible();
  await page.getByLabel("Type DELETE to confirm").fill("DELETE");
  await page.getByLabel("Your password").fill("not my password");
  await page.getByRole("button", { name: "Delete my account" }).click();
  await expect(page.getByText("That password isn't right.")).toBeVisible();

  await page.getByLabel(/Keep my published stories/).check();
  await page.getByLabel("Your password").fill(PASSWORD);
  await page.getByLabel("Type DELETE to confirm").fill("DELETE");
  await page.getByRole("button", { name: "Delete my account" }).click();
  await expect(page).toHaveURL(/\/account\/deleted$/);
  await expect(page.getByRole("heading", { name: "Your account has been deleted" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign out" })).toHaveCount(0);

  expect((await sql`select 1 from auth.users where id = ${me}`).length).toBe(0);
  expect((await sql`select 1 from public.articles where id = ${draft.id}`).length).toBe(0);
  expect((await page.request.get(`/u/${handle}`)).status()).toBe(404);
  await page.goto(`/a/${kept.slug}`);
  await expect(page.getByRole("heading", { name: kept.title })).toBeVisible();
  await expect(page.getByText("Former member")).toBeVisible();
});

test("members can delete their stories along with their account", async ({ page }) => {
  const { email } = await newSignedInUser(page, "eraser");
  const me = await userIdByEmail(email);
  const gone = await story(me, true);

  await gotoReady(page, "/settings");
  await page.getByRole("button", { name: "Delete my account…" }).click();
  await page.getByLabel(/Delete my stories too/).check();
  await page.getByLabel("Your password").fill(PASSWORD);
  await page.getByLabel("Type DELETE to confirm").fill("delete");
  await page.getByRole("button", { name: "Delete my account" }).click();
  await expect(page).toHaveURL(/\/account\/deleted$/);
  expect((await sql`select 1 from public.articles where id = ${gone.id}`).length).toBe(0);
  expect((await page.request.get(`/a/${gone.slug}`)).status()).toBe(404);
});

test("admins are told they can't delete their own account", async ({ page }) => {
  const { email } = await newSignedInUser(page, "lastadmin");
  await sql`update public.profiles set role = 'admin' where id = ${await userIdByEmail(email)}`;
  await gotoReady(page, "/settings");
  await expect(page.getByText(/Admins can't delete their own account/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Delete my account…" })).toHaveCount(0);
});
