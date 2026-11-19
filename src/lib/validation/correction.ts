import { z } from "zod";

/** Matches the corrections.body check in 20261119030000_revisions_and_corrections.sql. */
export const CORRECTION_MAX = 1000;

export const correctionSchema = z.object({
  articleId: z.uuid("This story can't be corrected."),
  body: z
    .string()
    .trim()
    .min(1, "Describe what was wrong and what's correct.")
    .max(CORRECTION_MAX, `Keep the correction to ${CORRECTION_MAX} characters.`),
});

export type CorrectionInput = z.infer<typeof correctionSchema>;

export function parseCorrectionForm(formData: FormData) {
  return correctionSchema.safeParse({
    articleId: String(formData.get("articleId") ?? ""),
    body: String(formData.get("body") ?? ""),
  });
}
