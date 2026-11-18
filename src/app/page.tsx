import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-serif text-4xl font-bold tracking-tight">{SITE_NAME}</h1>
      <p className="mt-2 text-lg opacity-80">{SITE_TAGLINE}</p>
    </main>
  );
}
