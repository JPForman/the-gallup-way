import Link from "next/link";
import type { MyAccount } from "@/lib/db/profiles";

/** Explains why the account can't write, with the fix when there is one. */
export function CannotWrite({ account }: { account: MyAccount | null }) {
  let message: React.ReactNode = "Your account can't write stories right now.";
  if (account?.suspended_until) {
    message = "Your account is suspended, so you can't write or edit stories right now.";
  } else if (account?.needs_terms || account?.needs_privacy) {
    message = (
      <>
        Please{" "}
        <Link href="/account/agreements" className="font-medium underline underline-offset-4">
          review and accept the updated agreements
        </Link>{" "}
        to keep writing.
      </>
    );
  } else if (account && !account.age_confirmed) {
    message = "Writing is limited to adults (18+). Use the Contact page if this is a mistake.";
  }
  return (
    <p role="status" className="rounded-md border border-border bg-muted p-4">
      {message}
    </p>
  );
}
