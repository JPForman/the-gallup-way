"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { deleteDraft } from "@/app/write/actions";

function ConfirmButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="destructive" className="h-11" disabled={pending}>
      {pending ? "Deleting…" : "Yes, delete it"}
    </Button>
  );
}

/** Two-step delete so a stray tap doesn't lose a draft. */
export function DeleteDraftButton({ articleId }: { articleId: string }) {
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <Button type="button" variant="outline" className="h-11" onClick={() => setConfirming(true)}>
        Delete draft
      </Button>
    );
  }
  return (
    <form action={deleteDraft} className="flex flex-wrap gap-2">
      <input type="hidden" name="articleId" value={articleId} />
      <ConfirmButton />
      <Button type="button" variant="ghost" className="h-11" onClick={() => setConfirming(false)}>
        Cancel
      </Button>
    </form>
  );
}
