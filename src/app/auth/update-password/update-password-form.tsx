"use client";

import { useActionState } from "react";
import { updatePassword, type FormState } from "@/app/auth/actions";
import { Field } from "@/components/forms/field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";

export function UpdatePasswordForm() {
  const [state, action] = useActionState<FormState, FormData>(updatePassword, {});
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormMessage message={state.message} status={state.status} />
      <Field
        name="password"
        label="New password"
        hint="At least 8 characters."
        type="password"
        autoComplete="new-password"
        minLength={8}
        maxLength={72}
        required
        errors={e.password}
      />
      <Field
        name="confirm"
        label="Confirm new password"
        type="password"
        autoComplete="new-password"
        required
        errors={e.confirm}
      />
      <SubmitButton pendingText="Saving…">Save new password</SubmitButton>
    </form>
  );
}
