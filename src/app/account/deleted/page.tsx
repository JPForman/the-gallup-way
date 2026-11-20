import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Account deleted", robots: { index: false, follow: false } };

export default function AccountDeletedPage() {
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-12">
      <h1 className="font-serif text-3xl font-bold tracking-tight">Your account has been deleted</h1>
      <p className="mt-4 leading-relaxed">
        You&apos;re signed out, and your profile is gone. Thanks for being part of the community board.
      </p>
      <p className="mt-2 text-muted-foreground">
        Copies of public pages may stay in search engines or other sites for a while. If you see something we
        missed, let us know through the{" "}
        <Link href="/contact" className="underline underline-offset-4">
          Contact page
        </Link>
        .
      </p>
      <p className="mt-6">
        <Link href="/" className="font-medium underline underline-offset-4">
          Back to the front page
        </Link>
      </p>
    </main>
  );
}
