"use client";

import { useActionState, useState } from "react";
import { Field } from "@/components/forms/field";
import { FormMessage } from "@/components/forms/form-message";
import { Button } from "@/components/ui/button";
import type { FormState } from "@/lib/forms/state";
import { deleteAccount } from "./actions";

const MODES = [
  {
    value: "anonymize",
    label: "Keep my published stories, without my name",
    hint: "Published stories and your comments stay up, credited to “Former member”. Drafts and unpublished stories are deleted.",
  },
  {
    value: "delete",
    label: "Delete my stories too",
    hint: "All your stories are deleted, and the text of your comments is erased.",
  },
] as const;

/** Account deletion: choose a mode, re-enter the password, type DELETE. */
export function DeleteAccountForm() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<FormState, FormData>(deleteAccount, {});
  const err = (k: string) => state.fieldErrors?.[k];
  const mode = state.values?.mode || "anonymize";

  if (!open) {
    return (
      <Button type="button" variant="outline" className="h-11" onClick={() => setOpen(true)}>
        Delete my account…
      </Button>
    );
  }

  return (
    <form action={action} className="space-y-5" noValidate>
      {state.message ? <FormMessage status="error" message={state.message} /> : null}
      <fieldset>
        <legend className="text-sm font-semibold">What happens to your stories?</legend>
        <div className="mt-2 space-y-1">
          {MODES.map((m) => (
            <label key={m.value} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-md px-2 py-2 hover:bg-muted">
              <input
                type="radio"
                name="mode"
                value={m.value}
                defaultChecked={mode === m.value}
                className="mt-1 size-4 accent-brand"
              />
              <span>
                <span className="block font-medium">{m.label}</span>
                <span className="block text-sm text-muted-foreground">{m.hint}</span>
              </span>
            </label>
          ))}
        </div>
        {err("mode") ? <p className="mt-1 text-sm font-medium text-destructive">{err("mode")?.join(" ")}</p> : null}
      </fieldset>
      <p className="text-sm text-muted-foreground">
        Either way, your profile, photo, likes, follows and saved stories are deleted. This can&apos;t be undone.
      </p>
      <Field name="password" label="Your password" type="password" autoComplete="current-password" errors={err("password")} />
      <Field
        name="confirm"
        label="Type DELETE to confirm"
        autoComplete="off"
        defaultValue={state.values?.confirm}
        errors={err("confirm")}
      />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="destructive" className="h-11" disabled={pending}>
          {pending ? "Deleting…" : "Delete my account"}
        </Button>
        <Button type="button" variant="ghost" className="h-11" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
