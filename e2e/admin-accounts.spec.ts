import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { newSignedInUser } from "./helpers/auth";
import { ACCEPTED_SIGNUP, sql, userIdByEmail } from "./helpers/db";
import { gotoReady } from "./helpers/page";

async function member(prefix: string) {
  const id = randomUUID();
  const tag = id.slice(0, 8);
  await sql`insert into auth.users (id, email, raw_user_meta_data) values (${id}, ${`${prefix}-${tag}@example.invalid`},
    ${sql.json({ handle: `${prefix}_${tag}`, display_name: `${prefix} ${tag}`, ...ACCEPTED_SIGNUP })})`;
  return { id, name: `${prefix} ${tag}` };
}

const REASON = "Reason (goes in the moderation log)";

test("moderators suspend and reinstate accounts and leave notes", async ({ page, isMobile }) => {
  test.skip(isMobile, "desktop only");
  const target = await member("spammer");
  const { email } = await newSignedInUser(page, "accountmod");
  await sql`update public.profiles set role = 'moderator' where id = ${await userIdByEmail(email)}`;

  await gotoReady(page, `/admin/users/${target.id}`);
  await expect(page.getByRole("heading", { name: target.name, level: 1 })).toBeVisible();
  // Moderators can't change roles.
  await expect(page.getByRole("button", { name: "Change role" })).toHaveCount(0);

  const actions = page.getByRole("region", { name: "Account actions" });
  await actions.getByLabel(REASON).fill("Posting ads in comments");
  await actions.getByRole("button", { name: "Suspend 7 days" }).click();
  await expect(actions.getByRole("button", { name: "Lift suspension" })).toBeVisible();
  const [row] = await sql<{ days: number }[]>`
    select round(extract(epoch from (suspended_until - now())) / 86400)::int as days from public.profiles where id = ${target.id}`;
  expect(row!.days).toBe(7);

  await actions.getByLabel("Note").fill("Warned about ads");
  await actions.getByRole("button", { name: "Add note" }).click();
  const history = page.getByRole("region", { name: "Staff history" });
  await expect(history.getByText("Warned about ads")).toBeVisible();
  await expect(history.getByText("Posting ads in comments")).toBeVisible();

  await actions.getByLabel(REASON).fill("Appeal accepted");
  await actions.getByRole("button", { name: "Lift suspension" }).click();
  await expect(actions.getByRole("button", { name: "Suspend 7 days" })).toBeVisible();
  const [after] = await sql<{ until: string | null }[]>`select suspended_until::text as until from public.profiles where id = ${target.id}`;
  expect(after!.until).toBeNull();
});

test("admins change roles; nobody can act on an admin", async ({ page, isMobile }) => {
  test.skip(isMobile, "desktop only");
  const target = await member("trusted");
  const otherAdmin = await member("otheradmin");
  await sql`update public.profiles set role = 'admin' where id = ${otherAdmin.id}`;
  const { email } = await newSignedInUser(page, "siteadmin");
  await sql`update public.profiles set role = 'admin' where id = ${await userIdByEmail(email)}`;

  await gotoReady(page, `/admin/users/${target.id}`);
  const actions = page.getByRole("region", { name: "Account actions" });
  await actions.getByLabel("New role").selectOption("moderator");
  await actions.getByLabel("Reason for the change").fill("Helps with the queue");
  await actions.getByRole("button", { name: "Change role" }).click();
  await expect(actions.getByRole("status").filter({ hasText: "Role updated." })).toBeVisible();
  const [row] = await sql<{ role: string }[]>`select role::text from public.profiles where id = ${target.id}`;
  expect(row!.role).toBe("moderator");

  await gotoReady(page, `/admin/users/${otherAdmin.id}`);
  await expect(page.getByText("Admin accounts can't be suspended or banned.")).toBeVisible();
  await expect(page.getByRole("button", { name: /Suspend|Ban/ })).toHaveCount(0);
});
