import { randomUUID } from "node:crypto";
import { sql } from "./db";

/**
 * A published story by a separate (password-less) author, unique to the test,
 * written straight to the LOCAL database.
 */
export async function storyByAnotherAuthor(prefix = "story") {
  const authorId = randomUUID();
  const tag = authorId.slice(0, 8);
  await sql`insert into auth.users (id, email, raw_user_meta_data) values (${authorId}, ${`author-${tag}@example.invalid`},
    ${sql.json({ handle: `author_${tag}`, display_name: "Story Author", age_confirmed: true, accepted_terms_version: 1, accepted_privacy_version: 1 })})`;
  const slug = `${prefix}-${tag}`;
  const [row] = await sql<{ id: string }[]>`
    insert into public.articles (author_id, slug, title, category, body_json, status, submitted_at, published_at)
    values (${authorId}, ${slug}, ${`${prefix} story ${tag}`}, 'community',
      '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Story text."}]}]}',
      'published', now(), now())
    returning id`;
  return { slug, id: row!.id };
}
