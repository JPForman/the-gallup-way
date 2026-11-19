import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth-card";
import { SignUpForm } from "./sign-up-form";

export const metadata: Metadata = { title: "Join" };

export default function SignUpPage() {
  return (
    <AuthCard
      title="Join the community board"
      intro="Create an account to post stories, comment and follow writers."
      footer={
        <p>
          Already have an account?{" "}
          <Link href="/auth/sign-in" className="font-medium underline underline-offset-4">
            Sign in
          </Link>
        </p>
      }
    >
      <SignUpForm />
    </AuthCard>
  );
}
