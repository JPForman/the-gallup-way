import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthCard } from "@/components/auth-card";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

const linkClass = "font-medium underline underline-offset-4";

export default function SignInPage() {
  return (
    <AuthCard
      title="Sign in"
      footer={
        <>
          <p>
            <Link href="/auth/forgot-password" className={linkClass}>
              Forgot your password?
            </Link>
          </p>
          <p>
            New here?{" "}
            <Link href="/auth/sign-up" className={linkClass}>
              Create an account
            </Link>
          </p>
        </>
      }
    >
      <Suspense>
        <SignInForm />
      </Suspense>
    </AuthCard>
  );
}
