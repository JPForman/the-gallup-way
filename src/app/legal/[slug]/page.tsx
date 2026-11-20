import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProsePage } from "@/components/prose-page";
import { LEGAL_PAGES, isLegalSlug } from "@/content/legal";
import { LEGAL_DRAFT, OPERATOR } from "@/lib/site";

export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(LEGAL_PAGES).map((slug) => ({ slug }));
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return isLegalSlug(slug) ? { title: LEGAL_PAGES[slug].title, description: LEGAL_PAGES[slug].summary } : {};
}

function formatUpdated(day: string): string {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

/** The DMCA designated agent (from OPERATOR; not part of any versioned text). */
function DmcaAgent() {
  const agent = OPERATOR.dmcaAgent;
  return (
    <section>
      <h2 className="font-serif text-xl font-semibold">Designated agent</h2>
      {agent ? (
        <address className="mt-3 not-italic">
          {agent.name}
          <br />
          {agent.address.split("\n").map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
          <a href={`mailto:${agent.email}`} className="underline underline-offset-4">
            {agent.email}
          </a>
          {agent.phone ? <span className="block">{agent.phone}</span> : null}
        </address>
      ) : (
        <p className="mt-3">
          Our designated agent will be listed here before launch. Until then, use the Report button or the{" "}
          <Link href="/contact" className="underline underline-offset-4">
            Contact page
          </Link>
          .
        </p>
      )}
    </section>
  );
}

export default async function LegalPage({ params }: Props) {
  const { slug } = await params;
  if (!isLegalSlug(slug)) notFound();
  const page = LEGAL_PAGES[slug];

  return (
    <ProsePage title={page.title} summary={page.summary}>
      <p className="text-sm text-muted-foreground">
        Last updated <time dateTime={page.updated}>{formatUpdated(page.updated)}</time>
      </p>
      {LEGAL_DRAFT ? (
        <p role="note" className="rounded-md border border-border bg-muted p-3 text-sm">
          This text hasn&apos;t been reviewed by a lawyer yet and may change before launch.
        </p>
      ) : null}
      {page.sections.map((s) => (
        <section key={s.heading}>
          <h2 className="font-serif text-xl font-semibold">{s.heading}</h2>
          {s.body.length > 1 ? (
            <ul className="mt-3 list-disc space-y-2 pl-5">
              {s.body.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-3">{s.body[0]}</p>
          )}
        </section>
      ))}
      {slug === "dmca" ? <DmcaAgent /> : null}
    </ProsePage>
  );
}
