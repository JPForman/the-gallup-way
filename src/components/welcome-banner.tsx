"use client";

import { useSearchParams } from "next/navigation";

/** Shown once after confirming an email (/auth/confirm adds ?welcome=1). */
export function WelcomeBanner() {
  const welcome = useSearchParams().get("welcome") === "1";
  if (!welcome) return null;
  return (
    <p role="status" className="mb-6 rounded-md border border-border bg-muted p-4">
      <strong className="font-semibold">Your email is confirmed.</strong> Welcome to the community
      board! You&apos;re signed in.
    </p>
  );
}
