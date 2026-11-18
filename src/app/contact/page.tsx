import type { Metadata } from "next";
import Link from "next/link";
import { ProsePage } from "@/components/prose-page";

export const metadata: Metadata = { title: "Contact" };

export default function ContactPage() {
  return (
    <ProsePage title="Contact" summary="Questions, concerns, or something you're named in?">
      <section>
        <h2 className="font-serif text-xl font-semibold">Report a post</h2>
        <p className="mt-3">
          The fastest way to flag a story, comment or profile is the Report button on it. Reports go
          straight to the moderation queue.
        </p>
      </section>
      <section>
        <h2 className="font-serif text-xl font-semibold">Everything else</h2>
        <p className="mt-3">
          A contact address will be listed here before launch. For copyright notices, see the{" "}
          <Link href="/legal/dmca" className="underline underline-offset-4">
            Copyright/DMCA page
          </Link>
          .
        </p>
      </section>
    </ProsePage>
  );
}
