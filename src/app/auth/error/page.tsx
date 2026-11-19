import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth-card";

export const metadata: Metadata = { title: "Link expired" };

const linkClass = "font-medium underline underline-offset-4";

export default function AuthErrorPage() {
  return (
    <AuthCard
      title="That link didn't work"
      intro="Email links expire after a while and can only be used once."
    >
      <ul className="list-disc space-y-2 pl-5">
        <li>
          Already confirmed? <Link href="/auth/sign-in" className={linkClass}>Sign in</Link>.
        </li>
        <li>
          Resetting a password?{" "}
          <Link href="/auth/forgot-password" className={linkClass}>Request a new link</Link>.
        </li>
      </ul>
    </AuthCard>
  );
}
