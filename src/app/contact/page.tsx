import type { Metadata } from "next";
import Link from "next/link";
import { ProsePage } from "@/components/prose-page";
import { OPERATOR } from "@/lib/site";

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
          Named in a story and think it&apos;s wrong? Appealing a moderation decision? Need help with your
          account, or want a deleted story back? Write to us
          {OPERATOR.contactEmail ? (
            <>
              {" "}
              at{" "}
              <a href={`mailto:${OPERATOR.contactEmail}`} className="font-medium underline underline-offset-4">
                {OPERATOR.contactEmail}
              </a>
              .
            </>
          ) : (
            <>. A contact address will be listed here before launch.</>
          )}{" "}
          Please include a link to the story, comment or profile it&apos;s about.
        </p>
        <p className="mt-3">
          For copyright notices, see the{" "}
          <Link href="/legal/dmca" className="underline underline-offset-4">
            Copyright/DMCA page
          </Link>
          .
        </p>
      </section>
    </ProsePage>
  );
}
