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
export const USER_ACTIONS = ["suspend_7", "suspend_30", "unsuspend", "ban"] as const;
export const ROLES = ["user", "moderator", "admin"] as const;

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
  z.object({
    kind: z.literal("user"),
    id: z.uuid(),
    action: z.enum(USER_ACTIONS),
    reason: modReasonSchema,
    reportId: z.coerce.number().int().positive().optional(),
  }),
  z.object({
    kind: z.literal("role"),
    id: z.uuid(),
    action: z.literal("set_role"),
    role: z.enum(ROLES, { error: "Choose a role." }),
    reason: modReasonSchema,
  }),
  z.object({
    kind: z.literal("note"),
    id: z.uuid(),
    action: z.literal("note"),
    reason: modReasonSchema,
  }),
]);

/** Suspension lengths offered on the account page. */
export const SUSPEND_DAYS = { suspend_7: 7, suspend_30: 30 } as const;

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
    role: get("role"),
  });
}
