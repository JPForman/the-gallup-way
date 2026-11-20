"use client";

import Link from "next/link";
import { Flag, X } from "lucide-react";
import { Dialog } from "radix-ui";
import { useId, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { REPORT_DETAILS_MAX, REPORT_REASONS, reportSchema, type ReportReason } from "@/lib/validation/report";

export type ReportTarget =
  | { type: "article"; id: string }
  | { type: "comment"; id: number }
  | { type: "profile"; id: string };

const NOUN: Record<ReportTarget["type"], string> = { article: "story", comment: "comment", profile: "profile" };

type Phase = "checking" | "signed-out" | "form" | "sent" | "duplicate";

export function reportErrorMessage(code: string | undefined, message: string | undefined): string {
  if (code === "PT429" && message) return message;
  if (code === "42501") return "Your account can't send reports right now. Check the notice at the top of the page.";
  return "Your report couldn't be sent. Please try again.";
}

function targetColumns(t: ReportTarget) {
  if (t.type === "article") return { target_type: t.type, article_id: t.id };
  if (t.type === "comment") return { target_type: t.type, comment_id: t.id };
  return { target_type: t.type, profile_id: t.id };
}

/**
 * "Report" button + dialog. Inserts straight into `reports`; the database
 * checks the reporter may write, the item is visible, duplicates and the
 * daily limit (see the moderation migration).
 */
export function ReportButton({
  target,
  signInNext,
  className,
}: {
  target: ReportTarget;
  /** Where to come back to after signing in. */
  signInNext: string;
  className?: string;
}) {
  const id = useId();
  const noun = NOUN[target.type];
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("checking");
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [errors, setErrors] = useState<{ reason?: string; details?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);

  async function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) return;
    setPhase("checking");
    setErrors({});
    const { data } = await createClient().auth.getSession();
    setPhase(data.session ? "form" : "signed-out");
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = reportSchema.safeParse({ reason: reason ?? undefined, details });
    if (!parsed.success) {
      const next: typeof errors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] === "details" ? "details" : "reason";
        next[key] ??= issue.message;
      }
      setErrors(next);
      return;
    }
    setBusy(true);
    setErrors({});
    const { error } = await createClient()
      .from("reports")
      .insert({ ...targetColumns(target), reason: parsed.data.reason, details: parsed.data.details ?? null });
    setBusy(false);
    if (!error) {
      setPhase("sent");
      setReason(null);
      setDetails("");
    } else if (error.code === "23505") {
      setPhase("duplicate");
    } else {
      setErrors({ form: reportErrorMessage(error.code, error.message) });
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(o) => void onOpenChange(o)}>
      <Dialog.Trigger asChild>
        <Button
          type="button"
          variant="ghost"
          className={cn("h-11 px-3 text-muted-foreground", className)}
          aria-label={`Report this ${noun}`}
        >
          <Flag className="size-4" aria-hidden />
          Report
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content
          className="fixed inset-x-0 bottom-0 z-50 max-h-[90dvh] overflow-y-auto rounded-t-xl border border-border bg-background p-5 shadow-lg sm:inset-auto sm:top-1/2 sm:left-1/2 sm:w-full sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl"
          aria-describedby={`${id}-desc`}
        >
          <div className="flex items-start justify-between gap-4">
            <Dialog.Title className="font-serif text-xl font-semibold">Report this {noun}</Dialog.Title>
            <Dialog.Close asChild>
              <Button type="button" variant="ghost" className="size-11 p-0" aria-label="Close">
                <X className="size-5" aria-hidden />
              </Button>
            </Dialog.Close>
          </div>
          <Dialog.Description id={`${id}-desc`} className="mt-1 text-sm text-muted-foreground">
            Moderators review every report against the Community Guidelines. The person you report won&apos;t see who
            reported them.
          </Dialog.Description>

          {phase === "checking" ? (
            <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
          ) : phase === "signed-out" ? (
            <p className="mt-4">
              <Link
                href={`/auth/sign-in?next=${encodeURIComponent(signInNext)}`}
                className="font-medium underline underline-offset-4"
              >
                Sign in to report
              </Link>
            </p>
          ) : phase === "sent" || phase === "duplicate" ? (
            <div className="mt-4 space-y-4">
              <p role="status" className="rounded-md border border-border bg-muted p-3">
                {phase === "sent"
                  ? "Thanks. A moderator will review this."
                  : "You've already reported this. A moderator will review it."}
              </p>
              <Dialog.Close asChild>
                <Button type="button" className="h-11">
                  Done
                </Button>
              </Dialog.Close>
            </div>
          ) : (
            <form onSubmit={submit} noValidate className="mt-4 space-y-4">
              <fieldset aria-describedby={errors.reason ? `${id}-reason-error` : undefined}>
                <legend className="text-sm font-semibold">What&apos;s wrong?</legend>
                <div className="mt-2 space-y-1">
                  {REPORT_REASONS.map((r) => (
                    <label
                      key={r.value}
                      className="flex min-h-11 cursor-pointer items-start gap-3 rounded-md px-2 py-2 hover:bg-muted"
                    >
                      <input
                        type="radio"
                        name={`${id}-reason`}
                        value={r.value}
                        checked={reason === r.value}
                        onChange={() => setReason(r.value)}
                        className="mt-1 size-4 accent-brand"
                      />
                      <span>
                        <span className="block font-medium">{r.label}</span>
                        <span className="block text-sm text-muted-foreground">{r.hint}</span>
                      </span>
                    </label>
                  ))}
                </div>
                {errors.reason ? (
                  <p id={`${id}-reason-error`} className="mt-1 text-sm font-medium text-destructive">
                    {errors.reason}
                  </p>
                ) : null}
              </fieldset>

              <div className="space-y-2">
                <Label htmlFor={`${id}-details`} className="text-sm font-semibold">
                  Details{reason === "other" ? "" : " (optional)"}
                </Label>
                <Textarea
                  id={`${id}-details`}
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  maxLength={REPORT_DETAILS_MAX}
                  aria-invalid={errors.details ? true : undefined}
                  aria-describedby={errors.details ? `${id}-details-error` : undefined}
                  className="min-h-24 text-base"
                />
                {errors.details ? (
                  <p id={`${id}-details-error`} className="text-sm font-medium text-destructive">
                    {errors.details}
                  </p>
                ) : null}
              </div>

              {errors.form ? (
                <p role="alert" className="text-sm font-medium text-destructive">
                  {errors.form}
                </p>
              ) : null}

              <Button type="submit" disabled={busy} className="h-11 w-full bg-brand text-brand-foreground hover:bg-brand/90">
                {busy ? "Sending…" : "Send report"}
              </Button>
            </form>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
