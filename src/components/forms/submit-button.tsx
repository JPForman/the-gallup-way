"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

export function SubmitButton({ children, pendingText }: { children: string; pendingText: string }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      className="h-11 w-full bg-brand text-base text-brand-foreground hover:bg-brand/90"
    >
      {pending ? pendingText : children}
    </Button>
  );
}
