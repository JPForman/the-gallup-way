"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { CheckboxField } from "@/components/forms/field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import type { FormState } from "@/lib/forms/state";
import { acceptCurrentAgreements } from "./actions";

const linkClass = "font-medium underline underline-offset-4";

export function AcceptForm() {
  const next = useSearchParams().get("next") ?? "/";
  const [state, action] = useActionState<FormState, FormData>(acceptCurrentAgreements, {});
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormMessage message={state.message} status={state.status} />
      <input type="hidden" name="next" value={next} />
      <CheckboxField name="accept" errors={state.fieldErrors?.accept}>
        I agree to the current{" "}
        <Link href="/legal/terms" target="_blank" className={linkClass}>
          Terms of Use
        </Link>{" "}
        and{" "}
        <Link href="/legal/privacy" target="_blank" className={linkClass}>
          Privacy Policy
        </Link>
        .
      </CheckboxField>
      <SubmitButton pendingText="Saving…">Continue</SubmitButton>
    </form>
  );
}
