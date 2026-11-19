import { expect, test } from "@playwright/test";
import { PASSWORD, fillSignUp as signUp, handleFor, signIn, signOutButton } from "./helpers/auth";
import { authLinkFromEmail, uniqueEmail } from "./helpers/mailpit";
import { gotoReady } from "./helpers/page";

test.describe("auth", () => {
  test("sign up, confirm by email, sign out and back in", async ({ page }) => {
    test.slow();
    const email = uniqueEmail("signup");
    await signUp(page, email);
    await expect(page).toHaveURL(/\/auth\/check-email$/);
    await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();

    // Can't sign in before confirming.
    await signIn(page, email);
    await expect(page.getByRole("main").getByRole("alert")).toContainText("confirm your email");

    await gotoReady(page, await authLinkFromEmail(email, "Confirm your email"));
    await expect(page).toHaveURL(/\/\?welcome=1$/);
    await expect(page.getByRole("main").getByRole("status")).toContainText("Your email is confirmed");
    await expect(signOutButton(page)).toBeVisible();

    await signOutButton(page).click();
    await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();

    await signIn(page, email);
    await expect(page).toHaveURL(/\/$/);
    await expect(signOutButton(page)).toBeVisible();
  });

  test("sign-up form explains what's missing", async ({ page }) => {
    await gotoReady(page, "/auth/sign-up");
    await page.getByLabel("Handle").fill("admin");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("Enter the name to show on your stories.")).toBeVisible();
    await expect(page.getByText(/some words are reserved/)).toBeVisible();
    await expect(page.getByText("You must be 18 or older to join.")).toBeVisible();
    await expect(page.getByText("You must accept the Terms and Privacy Policy.")).toBeVisible();
    await expect(page.getByLabel("Handle")).toHaveAttribute("aria-invalid", "true");
  });

  test("a taken handle is rejected", async ({ page }) => {
    const first = uniqueEmail("taken1");
    const handle = handleFor(first);
    await signUp(page, first, handle);
    await expect(page).toHaveURL(/\/auth\/check-email$/);

    await signUp(page, uniqueEmail("taken2"), handle);
    await expect(page.getByText("That handle is already taken.")).toBeVisible();
    // What the user typed is kept.
    await expect(page.getByLabel("Name")).toHaveValue("Test Resident");
  });

  test("wrong password shows a generic error", async ({ page }) => {
    await signIn(page, uniqueEmail("nobody"), "not the password");
    await expect(page.getByRole("main").getByRole("alert")).toHaveText("That email and password don't match.");
  });

  test("reset a forgotten password by email", async ({ page }) => {
    test.slow(); // two emails and three sign-ins
    const email = uniqueEmail("reset");
    await signUp(page, email);
    await gotoReady(page, await authLinkFromEmail(email, "Confirm your email"));
    await signOutButton(page).click();
    await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();

    await gotoReady(page, "/auth/forgot-password");
    await page.getByLabel("Email").fill(email);
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByRole("main").getByRole("status")).toContainText("If that email has an account");

    await gotoReady(page, await authLinkFromEmail(email, "Reset your password"));
    await expect(page).toHaveURL(/\/auth\/update-password$/);
    const newPassword = "a brand new password";
    await page.getByLabel("New password", { exact: true }).fill(newPassword);
    await page.getByLabel("Confirm new password").fill(newPassword);
    await page.getByRole("button", { name: "Save new password" }).click();
    await expect(page).toHaveURL(/\/$/);

    await signOutButton(page).click();
    await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
    await signIn(page, email, PASSWORD);
    await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
    await signIn(page, email, newPassword);
    await expect(signOutButton(page)).toBeVisible();
  });

  test("a bad or reused email link lands on the error page", async ({ page }) => {
    await page.goto("/auth/confirm?token_hash=nope&type=email");
    await expect(page).toHaveURL(/\/auth\/error$/);
    await expect(page.getByRole("heading", { name: "That link didn't work" })).toBeVisible();
  });

  test("next= only redirects within the site", async ({ page }) => {
    await page.goto("/auth/confirm?token_hash=nope&type=email&next=//evil.example");
    await expect(page).toHaveURL(/\/auth\/error$/);
  });
});
