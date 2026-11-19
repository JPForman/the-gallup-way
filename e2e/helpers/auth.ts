import { expect, type Page } from "@playwright/test";
import { authLinkFromEmail, uniqueEmail } from "./mailpit";
import { gotoReady } from "./page";

export const PASSWORD = "correct horse battery";

export function handleFor(email: string): string {
  return `u_${email.split("@")[0]!.replace(/[^a-z0-9]/g, "").slice(-20)}`;
}

export async function fillSignUp(page: Page, email: string, handle = handleFor(email)) {
  await gotoReady(page, "/auth/sign-up");
  await page.getByLabel("Name").fill("Test Resident");
  await page.getByLabel("Handle").fill(handle);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByLabel("I am 18 or older.").check();
  await page.getByLabel(/I agree to the Terms of Use/).check();
  await page.getByRole("button", { name: "Create account" }).click();
}

export async function signIn(page: Page, email: string, password = PASSWORD) {
  await gotoReady(page, "/auth/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

export const signOutButton = (page: Page) => page.getByRole("button", { name: "Sign out" });

/** Create a confirmed, signed-in user. Returns their email and handle. */
export async function newSignedInUser(page: Page, prefix: string) {
  const email = uniqueEmail(prefix);
  const handle = handleFor(email);
  await fillSignUp(page, email, handle);
  await expect(page).toHaveURL(/\/auth\/check-email$/);
  await gotoReady(page, await authLinkFromEmail(email, "Confirm your email"));
  await expect(signOutButton(page)).toBeVisible();
  return { email, handle };
}
