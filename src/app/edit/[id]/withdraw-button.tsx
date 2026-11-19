"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { withdrawArticle } from "@/app/write/actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" className="h-11" disabled={pending}>
      {pending ? "Withdrawing…" : "Withdraw from review"}
    </Button>
  );
}

/** Moves a story in review back to draft. */
export function WithdrawButton({ articleId }: { articleId: string }) {
  return (
    <form action={withdrawArticle}>
      <input type="hidden" name="articleId" value={articleId} />
      <Submit />
    </form>
  );
}
