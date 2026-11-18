import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProsePage } from "@/components/prose-page";
import { LEGAL_PAGES, isLegalSlug } from "@/content/legal";

export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(LEGAL_PAGES).map((slug) => ({ slug }));
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return isLegalSlug(slug) ? { title: LEGAL_PAGES[slug].title } : {};
}

export default async function LegalPage({ params }: Props) {
  const { slug } = await params;
  if (!isLegalSlug(slug)) notFound();
  const page = LEGAL_PAGES[slug];

  return (
    <ProsePage title={page.title} summary={page.summary}>
      <p role="note" className="rounded-md border border-border bg-muted p-3 text-sm">
        Draft. This text has not been reviewed by a lawyer yet and will change before launch.
      </p>
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
    </ProsePage>
  );
}
