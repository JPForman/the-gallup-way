import "server-only";
import { revalidatePath } from "next/cache";
import { CATEGORIES } from "@/lib/site";

/**
 * Refresh the cached public pages a story appears on: home, Latest, every
 * category (an edit may move it), its own page, and profile pages (story
 * lists and stats). Used after publishing, editing and staff actions.
 */
export function revalidatePublicPages(slug: string | null) {
  revalidatePath("/");
  revalidatePath("/latest");
  for (const c of CATEGORIES) revalidatePath(`/c/${c.slug}`);
  if (slug) revalidatePath(`/a/${slug}`);
  revalidatePath("/u/[handle]", "page");
  revalidatePath("/u/[handle]/stories/[cursor]", "page");
}
