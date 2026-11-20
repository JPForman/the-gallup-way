"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { deleteDraft, deleteStory } from "@/app/write/actions";

function ConfirmButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="destructive" className="h-11" disabled={pending}>
      {pending ? "Deleting…" : "Yes, delete it"}
    </Button>
  );
}

/**
 * Two-step delete so a stray tap doesn't lose work. `draft` permanently
 * deletes an unsubmitted draft; `story` soft-deletes a submitted story.
 */
export function DeleteDraftButton({ articleId, kind = "draft" }: { articleId: string; kind?: "draft" | "story" }) {
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <Button type="button" variant="outline" className="h-11" onClick={() => setConfirming(true)}>
        {kind === "draft" ? "Delete draft" : "Delete story"}
      </Button>
    );
  }
  return (
    <form action={kind === "draft" ? deleteDraft : deleteStory} className="flex flex-wrap gap-2">
      <input type="hidden" name="articleId" value={articleId} />
      <ConfirmButton />
      <Button type="button" variant="ghost" className="h-11" onClick={() => setConfirming(false)}>
        Cancel
      </Button>
    </form>
  );
}
