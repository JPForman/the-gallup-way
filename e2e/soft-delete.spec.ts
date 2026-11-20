import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { newSignedInUser } from "./helpers/auth";
import { sql, userIdByEmail } from "./helpers/db";
import { gotoReady } from "./helpers/page";

const BODY = (text: string) => ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] });

test("authors delete a published story; moderators see its history and undelete it", async ({ page, browser, isMobile }) => {
  test.skip(isMobile, "desktop only");
  test.slow();
  const { email } = await newSignedInUser(page, "deleter");
  const me = await userIdByEmail(email);
  const tag = randomUUID().slice(0, 8);
  const slug = `deletable-${tag}`;
  const [row] = await sql<{ id: string }[]>`
    insert into public.articles (author_id, slug, title, category, body_json, status, submitted_at, published_at)
    values (${me}, ${slug}, ${`Deletable story ${tag}`}, 'community', ${sql.json(BODY("First version."))}, 'published', now(), now())
    returning id`;
  const id = row!.id;
  // An edit after publishing leaves an earlier version behind.
  await sql`update public.articles set title = ${`Deletable story ${tag} (updated)`}, body_json = ${sql.json(BODY("Second version."))} where id = ${id}`;

  await gotoReady(page, `/edit/${id}`);
  await page.getByRole("button", { name: "Delete story" }).click();
  await page.getByRole("button", { name: "Yes, delete it" }).click();
  await expect(page).toHaveURL(/\/write\?deleted=story$/);
  await expect(page.getByText("Story deleted. It's no longer on the site.")).toBeVisible();
  await expect(page.getByRole("link", { name: new RegExp(`Deletable story ${tag}`) })).toHaveCount(0);
  expect((await page.request.get(`/a/${slug}`)).status()).toBe(404);

  // A moderator finds it, sees the earlier version, and undeletes it.
  const mod = await browser.newPage();
  const { email: modEmail } = await newSignedInUser(mod, "undeleter");
  await sql`update public.profiles set role = 'moderator' where id = ${await userIdByEmail(modEmail)}`;
  await gotoReady(mod, `/admin/articles/${id}`);
  await expect(mod.getByText("Deleted", { exact: true })).toBeVisible();
  const versions = mod.getByRole("region", { name: /Earlier versions/ });
  await expect(versions.getByRole("heading", { name: "Earlier versions (1)" })).toBeVisible();
  await versions.getByText(`Deletable story ${tag}`, { exact: true }).click();
  await expect(versions.getByText("First version.")).toBeVisible();

  await mod.getByLabel("Reason (goes in the moderation log)").fill("Author asked to bring it back");
  await mod.getByRole("button", { name: "Undelete story" }).click();
  await expect(mod.getByRole("status")).toHaveText("Story undeleted.");
  await expect.poll(async () => (await mod.request.get(`/a/${slug}`)).status()).toBe(200);
  await mod.close();
});
