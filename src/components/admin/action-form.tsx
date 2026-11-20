"use client";

import { useActionState, useId, useRef, type ReactNode } from "react";
import { moderate } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { FormState } from "@/lib/forms/state";
import type { ActionChoice } from "@/lib/admin/choices";
import { cn } from "@/lib/utils";
import { MOD_REASON_MAX } from "@/lib/validation/moderation";


/**
 * Reason box + one submit button per action. Every staff action needs a
 * reason (it goes in the moderation log).
 */
export function ActionForm({
  kind,
  id,
  reportId,
  choices,
  label = "Reason (goes in the moderation log)",
  children,
}: {
  kind: "article" | "comment" | "report" | "user" | "role" | "note";
  id: string | number;
  reportId?: number;
  choices: ActionChoice[];
  label?: string;
  /** Extra fields shown above the reason (e.g. a role picker). */
  children?: ReactNode;
}) {
  const fieldId = useId();
  // The clicked button's name/value isn't reliably in the submitted FormData,
  // so each button writes its action here first (click runs before submit).
  const actionInput = useRef<HTMLInputElement>(null);
  const [state, action, pending] = useActionState<FormState, FormData>(moderate, {});
  if (!choices.length) return null;
  const reasonError = state.fieldErrors?.reason?.[0];

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="id" value={String(id)} />
      <input ref={actionInput} type="hidden" name="action" defaultValue={choices[0]?.action} />
      {reportId ? <input type="hidden" name="reportId" value={String(reportId)} /> : null}
      {children}
      <Label htmlFor={fieldId} className="text-sm font-semibold">
        {label}
      </Label>
      <Textarea
        id={fieldId}
        name="reason"
        required
        maxLength={MOD_REASON_MAX}
        defaultValue={state.status === "error" ? state.values?.reason : ""}
        key={state.status === "success" ? state.message : "form"}
        aria-invalid={reasonError ? true : undefined}
        aria-describedby={reasonError ? `${fieldId}-error` : undefined}
        className="min-h-20 text-base"
      />
      {reasonError ? (
        <p id={`${fieldId}-error`} className="text-sm font-medium text-destructive">
          {reasonError}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {choices.map((c) => (
          <Button
            key={c.action}
            type="submit"
            onClick={() => {
              if (actionInput.current) actionInput.current.value = c.action;
            }}
            disabled={pending}
            variant={c.tone === "danger" ? "destructive" : "outline"}
            className={cn("h-11")}
          >
            {c.label}
          </Button>
        ))}
      </div>
      {state.message && !reasonError ? (
        <p
          role={state.status === "error" ? "alert" : "status"}
          className={cn("text-sm font-medium", state.status === "error" ? "text-destructive" : "text-foreground")}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
