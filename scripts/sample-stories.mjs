// Load fictional sample stories (with illustrations) into the LOCAL Supabase
// stack: pnpm db:samples. Refuses to run against anything but the local stack.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import postgres from "postgres";

const url = process.env.E2E_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
if (!/@(127\.0\.0\.1|localhost):54322\//.test(url)) {
  console.error("db:samples only runs against the local Supabase database.");
  process.exit(1);
}

// Local API URL and service key, straight from the CLI (local stack only).
const status = Object.fromEntries(
  execFileSync("pnpm", ["exec", "supabase", "status", "-o", "env"], { encoding: "utf8" })
    .split("\n")
    .map((l) => l.match(/^([A-Z_]+)="?(.*?)"?$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2]]),
);
const API = status.API_URL;
const KEY = status.SERVICE_ROLE_KEY;
if (!API || !/^http:\/\/(127\.0\.0\.1|localhost):54321$/.test(API) || !KEY) {
  console.error("Couldn't read the local Supabase status. Is `pnpm db:start` running?");
  process.exit(1);
}

// Story number -> illustrations (scripts/sample-images/<file>.webp, drawn by make-sample-images.mjs).
const ART = {
  1: [{ file: "library", alt: "Illustration of colorful books on three library shelves", caption: "The children's room shelves." }],
  2: [
    { file: "soccer", alt: "Illustration of a soccer ball on a green field below red mesas", caption: "Sunday's final." },
    { file: "trophy", alt: "Illustration of a gold trophy with confetti", caption: "The regional trophy." },
  ],
  3: [{ file: "snow", alt: "Illustration of an orange snow plow in falling snow", caption: "Plows are ready for the first storm." }],
  4: [{ file: "greenhouse", alt: "Illustration of a small greenhouse with rows of plants", caption: null }],
  6: [{ file: "craftfair", alt: "Illustration of four craft booths under colorful bunting", caption: "Booths fill the hall both days." }],
  8: [{ file: "bakery", alt: "Illustration of five loaves of bread on a counter", caption: "Green chile cheese bread." }],
  9: [{ file: "trail", alt: "Illustration of three hikers on a trail toward red mesas at sunset", caption: null }],
  14: [{ file: "market", alt: "Illustration of crates of squash and green and red chile", caption: "Winter produce at the market." }],
};

const sql = postgres(url, { max: 1, onnotice: () => {} });
try {
  await sql.unsafe(readFileSync(new URL("./sample-stories.sql", import.meta.url), "utf8"));

  let uploaded = 0;
  for (const [n, images] of Object.entries(ART)) {
    const id = `5a5a0000-0000-4000-8000-0000000001${n.padStart(2, "0")}`;
    const [row] = await sql`select author_id from public.articles where id = ${id}`;
    for (const [position, img] of images.entries()) {
      const path = `${row.author_id}/${id}/${img.file}.webp`;
      const res = await fetch(`${API}/storage/v1/object/article-images/${path}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "image/webp", "x-upsert": "true" },
        body: readFileSync(new URL(`./sample-images/${img.file}.webp`, import.meta.url)),
      });
      if (!res.ok) throw new Error(`Upload ${path} failed: ${res.status} ${await res.text()}`);
      await sql`insert into public.article_images (article_id, position, storage_path, alt_text, caption, credit)
        values (${id}, ${position}, ${path}, ${img.alt}, ${img.caption}, 'Sample illustration')`;
      uploaded++;
    }
  }

  const [{ n }] = await sql`select count(*)::int as n from public.articles where id::text like '5a5a0000-0000-4000-8000-0000000001%'`;
  console.log(`Loaded ${n} sample stories and ${uploaded} illustrations. Open http://localhost:3000 (cached pages refresh within a minute).`);
} finally {
  await sql.end();
}
