"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { clientIp, hashIp } from "@/lib/auth/ip-hash";
import { safeNext } from "@/lib/auth/redirect";
import { getMyAccount } from "@/lib/db/profiles";
import type { FormState } from "@/lib/forms/state";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  accept: z.literal("on", { error: "Please confirm you agree to continue." }),
  next: z.string().optional(),
});

/** Record acceptance of whichever current Terms/Privacy versions the user hasn't accepted. */
export async function acceptCurrentAgreements(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { status: "error", fieldErrors: { accept: ["Please confirm you agree to continue."] } };
  }

  const supabase = await createClient();
  const account = await getMyAccount(supabase).catch(() => null);
  if (!account) return { status: "error", message: "Please sign in again." };

  const kinds = [
    ...(account.needs_terms ? (["terms"] as const) : []),
    ...(account.needs_privacy ? (["privacy"] as const) : []),
  ];
  if (kinds.length) {
    const ip_hash = hashIp(clientIp(await headers()));
    // version and timestamp are set by the database (current version, now()).
    const rows = kinds.map((kind) => ({ kind, version: 0, ip_hash }));
    const { error } = await supabase.from("agreement_acceptances").insert(rows);
    if (error) return { status: "error", message: "We couldn't save that. Please try again." };
  }

  redirect(safeNext(parsed.data.next));
}
