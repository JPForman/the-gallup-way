import type { ReactNode } from "react";

export function AuthCard({
  title,
  intro,
  children,
  footer,
}: {
  title: string;
  intro?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="mx-auto w-full max-w-md px-4 py-8 md:py-12">
      <h1 className="font-serif text-3xl font-bold tracking-tight">{title}</h1>
      {intro ? <div className="mt-2 text-muted-foreground">{intro}</div> : null}
      <div className="mt-6">{children}</div>
      {footer ? <div className="mt-6 space-y-2 text-sm">{footer}</div> : null}
    </main>
  );
}
