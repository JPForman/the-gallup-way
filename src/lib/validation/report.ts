import { z } from "zod";

/** Matches public.report_reason and the reports checks in 20261123000000_moderation.sql. */
export const REPORT_DETAILS_MAX = 1000;

export const REPORT_REASONS = [
  { value: "defamation", label: "False claims about a real person", hint: "An accusation or damaging claim without support." },
  { value: "harassment", label: "Harassment or a personal attack", hint: "Insults, bullying or targeting someone." },
  { value: "threat", label: "Threat or violence", hint: "Threatening or encouraging harm. If someone is in danger, call 911." },
  { value: "copyright", label: "Copyright", hint: "Your writing or photo used without permission." },
  { value: "spam", label: "Spam or advertising", hint: "Ads, scams or repeated junk." },
  { value: "other", label: "Something else", hint: "Tell us what's wrong below." },
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number]["value"];

export const reportSchema = z
  .object({
    reason: z.enum(REPORT_REASONS.map((r) => r.value) as [ReportReason, ...ReportReason[]], {
      error: "Choose a reason.",
    }),
    details: z
      .string()
      .trim()
      .max(REPORT_DETAILS_MAX, `Keep details to ${REPORT_DETAILS_MAX} characters.`)
      .optional()
      .transform((d) => (d ? d : undefined)),
  })
  .refine((r) => r.reason !== "other" || !!r.details, {
    path: ["details"],
    message: "Tell us what's wrong.",
  });

export type ReportInput = z.infer<typeof reportSchema>;
