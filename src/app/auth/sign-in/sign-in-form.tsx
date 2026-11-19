"use client";

import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { signIn, type FormState } from "@/app/auth/actions";
import { Field } from "@/components/forms/field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";

export function SignInForm() {
  const next = useSearchParams().get("next") ?? "";
  const [state, action] = useActionState<FormState, FormData>(signIn, {});
  const e = state.fieldErrors ?? {};

  return (
    <form action={action} className="space-y-4" noValidate>
      <FormMessage message={state.message} status={state.status} />
      <input type="hidden" name="next" value={next} />
      <Field
        name="email"
        label="Email"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        defaultValue={state.values?.email}
        errors={e.email}
      />
      <Field
        name="password"
        label="Password"
        type="password"
        autoComplete="current-password"
        required
        errors={e.password}
      />
      <SubmitButton pendingText="Signing in…">Sign in</SubmitButton>
    </form>
  );
}
