"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/forms/form-message";
import { TextareaField } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";
import { addCorrection } from "@/app/write/actions";
import { CORRECTION_MAX } from "@/lib/validation/correction";

/** Append a correction to a published story. Corrections can't be edited or removed. */
export function CorrectionForm({ articleId }: { articleId: string }) {
  const [state, formAction] = useActionState(addCorrection, {});
  return (
    <form action={formAction} className="space-y-4" noValidate>
      <input type="hidden" name="articleId" value={articleId} />
      <TextareaField
        name="body"
        label="Add a correction"
        hint={`Say what was wrong and what's correct. It's shown on the story with today's date and can't be edited or removed later. Up to ${CORRECTION_MAX} characters.`}
        maxLength={CORRECTION_MAX}
        required
        defaultValue={state.values?.body ?? ""}
        errors={state.fieldErrors?.body}
      />
      <FormMessage status={state.status} message={state.message} />
      <div className="sm:max-w-56">
        <SubmitButton pendingText="Adding…">Add correction</SubmitButton>
      </div>
    </form>
  );
}
