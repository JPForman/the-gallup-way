import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth-card";

export const metadata: Metadata = { title: "Check your email" };

export default function CheckEmailPage() {
  return (
    <AuthCard
      title="Check your email"
      intro="We sent you a link to confirm your email address. Open it to finish creating your account."
      footer={
        <p>
          Already confirmed?{" "}
          <Link href="/auth/sign-in" className="font-medium underline underline-offset-4">
            Sign in
          </Link>
        </p>
      }
    >
      <p className="text-sm text-muted-foreground">
        The link works on any device. If you don&apos;t see the email in a few minutes, check your
        spam folder. If the address already had an account, no new email is sent; sign in or reset
        your password instead.
      </p>
    </AuthCard>
  );
}
