"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AGREEMENTS } from "@/content/agreements";
import { safeNext } from "@/lib/auth/redirect";
import { clientIp, hashIp } from "@/lib/auth/ip-hash";
import { fieldErrorsOf, formValues, type FormState } from "@/lib/forms/state";
import { createClient } from "@/lib/supabase/server";
import {
  resetRequestSchema,
  signInSchema,
  signUpSchema,
  updatePasswordSchema,
} from "@/lib/validation/auth";

export type { FormState };

// ---------------------------------------------------------------------------
// Sign up
// ---------------------------------------------------------------------------
export async function signUp(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData, ["email", "displayName", "handle"]);
  const parsed = signUpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsOf(parsed.error), values };
  }
  const { email, password, displayName, handle } = parsed.data;

  const supabase = await createClient();

  // Friendly early check. The signup trigger still falls back safely on a race.
  const { data: taken } = await supabase
    .from("profiles")
    .select("id")
    .eq("handle", handle)
    .maybeSingle();
  if (taken) {
    return { status: "error", fieldErrors: { handle: ["That handle is already taken."] }, values };
  }

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Read by public.handle_new_user() to create the profile and record
      // the 18+ attestation and Terms/Privacy acceptance.
      data: {
        handle,
        display_name: displayName,
        age_confirmed: true,
        accepted_terms_version: AGREEMENTS.terms.version,
        accepted_privacy_version: AGREEMENTS.privacy.version,
        ip_hash: hashIp(clientIp(await headers())),
      },
    },
  });

  if (error) {
    if (error.code === "weak_password") {
      return { status: "error", fieldErrors: { password: [error.message] }, values };
    }
    if (error.code === "over_email_send_rate_limit" || error.status === 429) {
      return {
        status: "error",
        message: "Too many sign-up attempts. Please wait a few minutes and try again.",
        values,
      };
    }
    return { status: "error", message: "We couldn't create your account. Please try again.", values };
  }

  // Same response whether or not the email was already registered, so the
  // form can't be used to discover who has an account.
  redirect("/auth/check-email");
}

// ---------------------------------------------------------------------------
// Sign in / out
// ---------------------------------------------------------------------------
export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData, ["email"]);
  const parsed = signInSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsOf(parsed.error), values };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    if (error.code === "email_not_confirmed") {
      return {
        status: "error",
        message: "Please confirm your email first. Check your inbox for the link we sent.",
        values,
      };
    }
    return { status: "error", message: "That email and password don't match.", values };
  }

  redirect(safeNext(parsed.data.next));
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

// ---------------------------------------------------------------------------
// Password reset
// ---------------------------------------------------------------------------
export async function requestPasswordReset(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = formValues(formData, ["email"]);
  const parsed = resetRequestSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsOf(parsed.error), values };
  }

  const supabase = await createClient();
  // The recovery email template links to /auth/confirm?type=recovery.
  await supabase.auth.resetPasswordForEmail(parsed.data.email);

  // Always the same answer, whether or not the address has an account.
  return {
    status: "success",
    message: "If that email has an account, we've sent a link to reset the password.",
    values,
  };
}

export async function updatePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = updatePasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsOf(parsed.error) };
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    return {
      status: "error",
      message: "Your reset link has expired. Request a new one from the sign-in page.",
    };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (error.code === "same_password") {
      return { status: "error", fieldErrors: { password: ["Choose a different password."] } };
    }
    if (error.code === "weak_password") {
      return { status: "error", fieldErrors: { password: [error.message] } };
    }
    return { status: "error", message: "We couldn't update your password. Please try again." };
  }

  redirect("/");
}
