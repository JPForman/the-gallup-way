import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthCard } from "@/components/auth-card";
import { AcceptForm } from "./accept-form";

export const metadata: Metadata = { title: "Updated terms" };

export default function AgreementsPage() {
  return (
    <AuthCard
      title="We've updated our terms"
      intro="Please review and accept the current Terms of Use and Privacy Policy to keep posting, commenting and reacting. You can still read everything without accepting."
    >
      <Suspense>
        <AcceptForm />
      </Suspense>
    </AuthCard>
  );
}
