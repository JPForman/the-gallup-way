import { z } from "zod";

/** Matches mod_require_staff() in 20261123000000_moderation.sql. */
export const MOD_REASON_MAX = 1000;

export const modReasonSchema = z
  .string()
  .trim()
  .min(1, "Give a reason. It goes in the moderation log.")
  .max(MOD_REASON_MAX, `Keep the reason to ${MOD_REASON_MAX} characters.`);

export const ARTICLE_ACTIONS = ["hide", "restore", "approve", "reject", "lock_comments", "unlock_comments"] as const;
export const COMMENT_ACTIONS = ["remove", "restore"] as const;

export const moderationFormSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("article"),
    id: z.uuid(),
    action: z.enum(ARTICLE_ACTIONS),
    reason: modReasonSchema,
    reportId: z.coerce.number().int().positive().optional(),
  }),
  z.object({
    kind: z.literal("comment"),
    id: z.coerce.number().int().positive(),
    action: z.enum(COMMENT_ACTIONS),
    reason: modReasonSchema,
    reportId: z.coerce.number().int().positive().optional(),
  }),
  z.object({
    kind: z.literal("report"),
    id: z.coerce.number().int().positive(),
    action: z.literal("dismiss"),
    reason: modReasonSchema,
  }),
]);

export type ModerationForm = z.infer<typeof moderationFormSchema>;

/** FormData → parsed input (empty optional fields are dropped). */
export function parseModerationForm(formData: FormData) {
  const get = (k: string) => {
    const v = formData.get(k);
    return typeof v === "string" && v !== "" ? v : undefined;
  };
  return moderationFormSchema.safeParse({
    kind: get("kind"),
    id: get("id"),
    action: get("action"),
    reason: get("reason") ?? "",
    reportId: get("reportId"),
  });
}
