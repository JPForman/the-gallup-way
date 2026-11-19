"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signUp, type FormState } from "@/app/auth/actions";
import { CheckboxField, Field } from "@/components/forms/field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";

const linkClass = "font-medium underline underline-offset-4";

export function SignUpForm() {
  const [state, action] = useActionState<FormState, FormData>(signUp, {});
  const e = state.fieldErrors ?? {};
  const v = state.values ?? {};

  return (
    <form action={action} className="space-y-4" noValidate>
      <FormMessage message={state.message} status={state.status} />
      <Field
        name="displayName"
        label="Name"
        hint="Shown on everything you post. Your real name is encouraged."
        autoComplete="name"
        maxLength={60}
        required
        defaultValue={v.displayName}
        errors={e.displayName}
      />
      <Field
        name="handle"
        label="Handle"
        hint="Your profile address: 3–30 lowercase letters, numbers or underscores."
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        maxLength={31}
        required
        defaultValue={v.handle}
        errors={e.handle}
      />
      <Field
        name="email"
        label="Email"
        hint="Kept private. Never shown on the site."
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        defaultValue={v.email}
        errors={e.email}
      />
      <Field
        name="password"
        label="Password"
        hint="At least 8 characters."
        type="password"
        autoComplete="new-password"
        minLength={8}
        maxLength={72}
        required
        errors={e.password}
      />
      <div className="space-y-1 pt-2">
        <CheckboxField name="ageConfirmed" errors={e.ageConfirmed}>
          I am 18 or older.
        </CheckboxField>
        <CheckboxField name="acceptTerms" errors={e.acceptTerms}>
          I agree to the{" "}
          <Link href="/legal/terms" target="_blank" className={linkClass}>
            Terms of Use
          </Link>{" "}
          and{" "}
          <Link href="/legal/privacy" target="_blank" className={linkClass}>
            Privacy Policy
          </Link>
          .
        </CheckboxField>
      </div>
      <SubmitButton pendingText="Creating account…">Create account</SubmitButton>
    </form>
  );
}
