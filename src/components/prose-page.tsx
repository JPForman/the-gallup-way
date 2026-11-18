import type { ReactNode } from "react";

export function ProsePage({
  title,
  summary,
  children,
}: {
  title: string;
  summary?: string;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto max-w-2xl px-4 py-8 md:py-12">
      <h1 className="font-serif text-3xl font-bold tracking-tight md:text-4xl">{title}</h1>
      {summary ? <p className="mt-3 text-lg text-muted-foreground">{summary}</p> : null}
      <div className="mt-8 space-y-8 leading-relaxed">{children}</div>
    </main>
  );
}
