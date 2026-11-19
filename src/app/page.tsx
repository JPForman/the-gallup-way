import { Suspense } from "react";
import { WelcomeBanner } from "@/components/welcome-banner";
import { SITE_NAME } from "@/lib/site";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="sr-only">{SITE_NAME}: today&apos;s stories</h1>
      <Suspense>
        <WelcomeBanner />
      </Suspense>
      <section className="rounded-md border border-dashed border-border p-8 text-center">
        <p className="font-serif text-2xl font-semibold">Stories are on the way.</p>
        <p className="mt-2 text-muted-foreground">
          The feed arrives in Phase 4. Until then, this is the layout shell.
        </p>
      </section>
    </main>
  );
}
