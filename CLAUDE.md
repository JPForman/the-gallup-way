# CLAUDE.md — The Gallup Way (community news board)

Read this file at the start of every session. The product spec is `docs/PRD.md`, the phased task list is `docs/BUILD_PLAN.md`, and moderation/legal policy is `docs/MODERATION.md`.

On commit make sure to update the Claude.md and docs as needed.

## What this is
A free, mobile-first **community board** for local Gallup stories, run by one person on $0/month. Residents post stories; everyone reads them in a clean, newspaper-style layout; readers like, comment, follow writers and bookmark stories. It should feel like a legitimate local publication, not Reddit or Facebook: strong headlines, categories, clean typography, no outrage mechanics.

It is **not a newspaper**: the operator does not write, edit or endorse user posts. Keep it that way in code and copy (see Legal guardrails).

The site name lives in one constant: `src/lib/site.ts` → `SITE_NAME = "The Gallup Way"`. Never hard-code the name elsewhere. Footer legal links (`LEGAL_LINKS`) and the story categories (`CATEGORIES`, mirrored from the `categories` table and checked by `src/lib/site.test.ts`, so the header needs no DB read; `NAV_CATEGORIES` is derived from it) live there too.

## Stack (do not swap without asking)
| Concern | Choice | Notes |
|---|---|---|
| Framework | Next.js 15 (App Router) + React + TypeScript (strict) | Server Components by default, Server Actions for mutations |
| Styling | Tailwind CSS | Mobile-first: design at 375px, then scale up |
| UI parts | shadcn/ui (copy-in components, `src/components/ui`) | No heavy UI kits. `cn()` = `clsx` + `tailwind-merge` in `src/lib/utils.ts`. Add components with `pnpm ui:add <name>` (undoes the CLI's switch to the `cn` package). Use native `<input type="checkbox">` (`CheckboxField`), not shadcn's button-based checkbox |
| Theming | `next-themes` (class strategy, defaults to system) | Colors are CSS tokens in `src/app/globals.css`: newsprint neutrals + `brand` (red-rock accent); serif (Source Serif 4) for headlines, Inter for UI |
| Rich text | Tiptap (limited extensions) | Stored as JSON; rendered via allowlist renderer (see Coding rules) |
| Database + Auth + Storage | Supabase (free plan) | Postgres, email-verified auth, Row Level Security, Storage |
| Supabase client | `@supabase/ssr` | Cookie-based sessions in Server Components and middleware |
| Validation | Zod | Every Server Action validates input with a Zod schema |
| Transactional email | Resend (free) as Supabase custom SMTP | Supabase's built-in mailer is too rate-limited for real users |
| Hosting | Vercel Hobby (free) | Preview deploy per PR, production on `main` |
| CI | GitHub Actions | Lint, typecheck, unit, DB policy tests, e2e |
| Unit/component tests | Vitest + React Testing Library + `@testing-library/user-event` | jsdom environment |
| E2E tests | Playwright | Runs against a local Supabase stack in CI |
| DB tests | pgTAP via `supabase test db` | Proves RLS policies actually block what they should |
| Package manager | pnpm | Commit `pnpm-lock.yaml` |

## Free-tier budget (checked Nov 2026; re-check before launch)
- **Vercel Hobby:** 100 GB transfer, 1M function invocations, 4 active CPU-hours, 5,000 image transformations / month. Over the limit the feature pauses (no surprise bill). Hobby is **personal, non-commercial**: no ads, paid posts or sponsorships while on Hobby.
- **Supabase Free:** 500 MB DB, 1 GB storage, 5 GB egress/month, 50,000 MAU, 2 projects. Pauses after 7 days of inactivity (a weekly CI ping prevents this).
- **Resend Free:** 3,000 emails/month, 100/day.
- **GitHub Actions:** unlimited on a public repo; 2,000 min/month private.

Rules that keep us inside those limits:
- No `next/image` optimization: `images.unoptimized: true`.
- Compress images in the browser before upload (`browser-image-compression`): WebP, max 1600px wide, target ≤ 250 KB. Reject files > 5 MB before compressing. Max 3 images per article.
- Cache reads: feed and article pages use ISR (`revalidate = 60`) and `revalidateTag` after mutations.
- Paginate everything (cursor-based, 20 items). No unbounded queries.
- Ranking runs in Postgres (SQL function), not in a Vercel function looping over rows.
- View counts are a daily aggregate row per article, never one row per view.
- No per-request console logging in production.

Fallbacks if a limit bites (don't implement now; keep code portable): Cloudflare Workers via `@opennextjs/cloudflare` (allows commercial use); Neon for Postgres. All data access goes through `src/lib/db/*` so the backend can be swapped.

## Project layout
```
src/
  app/
    (feed)/page.tsx       # home: Top / Latest / Following tabs
    c/[slug]/             # category feed
    a/[slug]/page.tsx     # article
    write/  edit/[id]/    # editor
    u/[handle]/           # profile
    search/  saved/       # search, bookmarks
    settings/             # profile edit, account deletion
    admin/                # staff-only area (queue, users, log)
    legal/[slug]/         # terms, privacy, guidelines, contributor-agreement, corrections, dmca (from src/content/legal.ts)
    contact/
    auth/                 # sign-in, sign-up, callback, reset
  components/             # UI components (+ *.test.tsx next to them); ui/ = shadcn
  content/                # static copy (legal.ts: draft legal pages)
  lib/
    site.ts               # SITE_NAME and other constants
    supabase/             # server.ts, client.ts, middleware.ts, types.ts (generated)
    db/                   # typed query functions, one file per table
    validation/           # zod schemas
    richtext/             # tiptap extensions list + allowlist renderer
    ranking.ts            # mirrors SQL ranking for unit tests
  middleware.ts
supabase/
  migrations/             # SQL migrations (source of truth for schema + RLS)
  tests/                  # pgTAP RLS tests
  seed.sql                # local dev seed data
e2e/                      # Playwright specs
docs/                     # PRD, BUILD_PLAN, MODERATION
.github/workflows/        # CI
```

## Commands
```
pnpm dev                 # Next dev server
pnpm lint                # eslint
pnpm typecheck           # tsc --noEmit
pnpm test                # vitest run (config: vitest.config.mts, setup: vitest.setup.ts)
pnpm test:watch          # vitest watch mode
pnpm test:e2e            # playwright test --trace off (mobile 375px + desktop projects; starts `pnpm dev` on :3100, or `pnpm start` in CI)
pnpm db:start            # supabase start: local Postgres/Auth/Storage/Mailpit (Docker must be running)
pnpm db:stop             # supabase stop
pnpm db:reset            # re-apply migrations + seed
pnpm db:test             # pgTAP RLS tests (supabase/tests/*.test.sql)
pnpm db:types            # regenerate src/lib/supabase/types.ts from the local DB
pnpm exec supabase ...   # any other Supabase CLI command (CLI is a pinned devDependency)
```
Local URLs: API http://127.0.0.1:54321 · Studio http://127.0.0.1:54323 · Mailpit (catches auth emails) http://127.0.0.1:54324.

## Repo and workflow
- GitHub: https://github.com/JPForman/the-gallup-way (public; unlimited Actions minutes).
- Vercel: https://the-gallup-way.vercel.app (production from `main`, preview per PR). Env vars set there: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. No service-role key on Vercel until account deletion (6.6).
- Supabase cloud project: ref `bhxfsxkczoonqrjhmoxx` (West US), API `https://bhxfsxkczoonqrjhmoxx.supabase.co`. The CLI is linked (`supabase/.temp/project-ref`, git-ignored). Push migrations with `pnpm exec supabase db push` only after the PR is merged to `main`.
- Linking writes the cloud's service versions into `supabase/.temp/*-version` and `storage-migration`. If `pnpm db:start` fails after a (re)link, delete those files (keep `project-ref`), remove this project's Supabase containers and volumes, and start again.
- Work on a `step-X.Y-…` branch, then PR to `main` once CI is green. Commits use the GitHub noreply email set in this repo's local git config. Never commit with a personal email.
- **Step loop (agreed with the owner; no need to re-ask each step):**
  1. `git checkout main && git pull`, then `git checkout -b step-X.Y-name`.
  2. Build the step: migration + pgTAP test for any DB change, `pnpm db:reset && pnpm db:test && pnpm db:types`, unit tests, a Playwright spec for the main path.
  3. Locally: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`, and the relevant `pnpm exec playwright test e2e/<spec>`.
  4. Update CLAUDE.md / docs and tick the step in `docs/BUILD_PLAN.md` in the same commit.
  5. Push, `gh pr create`, watch CI (`gh run watch`), then `gh pr merge <n> --rebase --delete-branch`.
  6. If the step added migrations: `pnpm exec supabase db push --dry-run`, then `pnpm exec supabase db push`.
  7. Summarize for the owner and ask before starting the next step.
- **Owner does (don't attempt):** Supabase/Vercel dashboards, DNS/Resend, any real passwords or secrets. Never set or type a password for a real account. Test credentials go only in seed/fixture files, and they're not repeated in chat.
- **Session start:** Docker Desktop running → `pnpm db:start` (then `pnpm db:reset` if migrations changed) → `pnpm dev` when the owner wants to look around (http://localhost:3000).

## CI (`.github/workflows/ci.yml`)
- `checks` job: lint, typecheck, unit tests.
- `integration` job: starts local Supabase, fails if `src/lib/supabase/types.ts` is stale (run `pnpm db:types` and commit), runs pgTAP, builds, runs Playwright (report uploaded on failure).
- Runners pinned to `ubuntu-24.04`: `ubuntu-latest` is 26.04, which Playwright 1.56 doesn't support. Unpin after a Playwright upgrade.
- Node 22 in CI. Local Node 20 still works, but Node 20 reached end-of-life in April 2026, so upgrade to 22 or 24 LTS.
- E2E helpers: `newSignedInUser(page, prefix)` and sign-in helpers in `e2e/helpers/auth.ts`. `sql` / `userIdByEmail` in `e2e/helpers/db.ts` set up state in the LOCAL database only (e.g. suspensions); change only the test's own user. `gotoReady(page, path)` waits for `<html data-hydrated>` (set by `HydrationMarker`) before using forms. `authLinkFromEmail(to, subject)` reads Mailpit and returns the `/auth/confirm` path. Use `uniqueEmail()` per test. Scope `role=alert`/`status` queries to `main`, because Next's dev route announcer also uses `role=alert`.
- If local auth emails arrive with Supabase's default subject or body, the gateway lost the custom templates: run `pnpm db:stop && pnpm db:start`.
- Local `supabase/config.toml` raises auth rate limits (email, sign-in, verification) for e2e. Cloud limits are separate (Dashboard → Authentication → Rate Limits).
- Redirecting Server Actions (save, publish) can take > 10 s on a cold `pnpm dev` under the parallel suite; e2e waits up to 30 s after them (`AFTER_ACTION` in `e2e/publish.spec.ts`). Known dev-only flake: the first save on `/write` once rendered `/edit/<id>` while the address bar stayed `/write` (not reproduced in 12 reruns or in CI, which uses `pnpm start`). If it shows up again, look at the `saveArticle` redirect inside `startTransition`.
- Every e2e page check includes an axe accessibility scan in light and dark mode (`e2e/smoke.spec.ts`); new pages should be added to that list.

## Environment
- `.env.local` (git-ignored; template in `.env.example`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `IP_HASH_SALT` (server-only). Local values: `pnpm exec supabase status -o env`.
- Public env is validated by Zod in `src/lib/env.ts` (`getPublicEnv()`, lazy). In dev, middleware skips session refresh if Supabase isn't configured; in production a missing var throws.
- Supabase clients: `src/lib/supabase/server.ts` (Server Components/Actions, `server-only`), `client.ts` (Client Components), `middleware.ts` (`updateSession`, called by `src/middleware.ts`; matcher skips static assets and `/legal/*` to save invocations).
- Known harmless build warning: supabase-js references `process.version(s)` in the Edge runtime (guarded in the library).
- pnpm only runs install scripts for packages in `package.json` → `pnpm.onlyBuiltDependencies` (currently `supabase`, which downloads the CLI binary).

## Auth (`src/app/auth/`)
- Server Actions in `src/app/auth/actions.ts`: `signUp`, `signIn`, `signOut`, `requestPasswordReset`, `updatePassword`. They return `FormState` (`message`, `status`, `fieldErrors`, `values` echo without passwords) for `useActionState` forms.
- Email links use `token_hash` templates (`supabase/templates/*.html`) pointing to `GET /auth/confirm` (`verifyOtp`), so links work on any device. Don't use the default PKCE `?code=` flow.
- Sign-up sends `handle`, `display_name`, `age_confirmed`, `accepted_terms_version`, `accepted_privacy_version` and `ip_hash` as user metadata (read by `handle_new_user`). Sign-up and reset responses never reveal whether an email is registered.
- `safeNext()` (`src/lib/auth/redirect.ts`) sanitizes every `next` redirect. IPs go through `hashIp(clientIp(headers))`, which returns null without `IP_HASH_SALT`.
- The header's sign-in state (`AuthControls`) is a client component, so pages stay static. Never read cookies or the user in the root layout or header on the server.
- Forms: `Field` / `CheckboxField` / `FormMessage` / `SubmitButton` in `src/components/forms/` (labels, hints and errors wired with `aria-describedby` and `aria-invalid`).
- Shared form types: `FormState`, `formValues`, `fieldErrorsOf` in `src/lib/forms/state.ts`.
- Validation mirrors the DB: `src/lib/validation/handle.ts` must match `is_valid_handle()` (checked by test).

## Data access patterns
- **Public, cached pages** (ISR) read through `createPublicClient()` (`src/lib/supabase/public.ts`): no cookies, always `anon`. A dynamic route also needs `generateStaticParams() { return [] }` plus `export const revalidate = 60` to be ISR (`●` in the build output, not `ƒ`). After a mutation, `revalidatePath` the affected public pages.
- **Per-user pages** (`/settings`, `/me`) use the cookie-based server client and are dynamic.
- **Owner-only UI on cached pages** (e.g. "Edit profile") is a small client component that compares the session user id. It's display only.
- **Profiles are column-restricted:** clients may select only `PUBLIC_PROFILE_COLUMNS` (`id, handle, display_name, bio, avatar_path, role, created_at`; `select *` fails) and update only `handle, display_name, bio, avatar_path`. Private status comes from `rpc('my_account')` (suspension, 18+, approval count, `needs_terms`/`needs_privacy`, `can_write`). Helpers are in `src/lib/db/profiles.ts`.
- **Avatars:** public bucket `avatars`, path `<user id>/<name>.webp` (DB check constraint plus storage policies on the owner's folder), ≤ 200 KB WebP. The browser compresses to ≤ 512px, ~100 KB (`src/lib/images/compress.ts`, lazy-loaded) and uploads directly. The form saves the path, and the old file is deleted.
- **Articles** (`articles`): clients insert/update only `title, dek, body_json, category, content_type` (column grants). Owner, `status`, `slug`, `submitted_at`, `published_at`, `comments_locked`, `deleted_at` are set by the `articles_before_write` trigger and SECURITY DEFINER RPCs, and the trigger raises 42501 if a client changes them. `body_text` is derived from `body_json` in the DB (`richtext_plain()`), and `search` is a generated tsvector (title A, dek B, body C). `category` is the category slug.
- **Status changes go through RPCs:** `rpc('submit_article', { p_article_id })` (draft → `pending_review` or `published`; needs a complete story and a current Contributor Agreement acceptance row for that article; assigns the slug `<slugified-title>-<6 hex>`, then frozen) and `rpc('withdraw_article', ...)` (pending_review → draft). Staff review, hide and restore come in Phase 6.
- **Article children:** `article_sources` (≤ 10, `http(s)` only) and `article_images` (≤ 3, positions 0–2, `alt_text`, `caption`, `credit`) follow the article's visibility (`can_view_article()`) and are editable while `can_edit_article()`. Image files live in the public `article-images` bucket at `<author id>/<article id>/<name>.webp` (≤ 400 KB WebP; check constraint + storage policies). Authors hard-delete only never-submitted drafts; submitted stories are soft-deleted.
- **Saving stories:** `rpc('save_article', {...})` (SECURITY INVOKER, so RLS/grants/guard apply) writes content, sources and images in one transaction; omit `p_article_id` to create a draft. Returns `{id, status, slug, removed_paths}`; the action deletes `removed_paths` from Storage. Form parsing/validation: `parseArticleForm(formData, userId)` in `src/lib/validation/article.ts` (repeated `sourceUrl`/`sourceLabel`, `imagePath`/`imageAlt`/`imageCaption`/`imageCredit`; body JSON is re-sanitized). Server Actions `saveArticle`, `deleteDraft` in `src/app/write/actions.ts`; read helpers `getArticleForEdit`, `listMyArticles`, `articleImageUrl` in `src/lib/db/articles.ts`.
- **Editor UI:** `/write` (new story + "Your stories") and `/edit/[id]` (dynamic, author only, 404 otherwise). Photos need a saved draft (their folder is the article id); they're compressed in the browser (`compressArticleImage`: WebP ≤ 1600px, ~250 KB) and uploaded immediately, and the list is saved with the form. Photo description (alt text) is required. Long forms submit via `startTransition(() => formAction(fd))` from `onSubmit`, not `<form action>`, so React 19 doesn't reset the fields after a save. Components: `src/components/editor/{rich-text-editor,sources-editor,images-editor}.tsx`.
- **Publish flow (3.4):** drafts (on `/write` and `/edit/[id]`) show a Publish section: Contributor Agreement checkbox (`agreement`) and a "Publish" / "Submit for review" button (`intent=publish`; label from `publishInfo(account)` in `src/lib/db/profiles.ts`, which mirrors `can_publish_directly()`). `saveArticle` checks `publishProblems(input)` (headline ≥ 5, category, body) and the checkbox before saving, then saves, inserts the contributor acceptance (`version: 0` → DB sets current; `ip_hash`) and calls `submit_article`. Results redirect to `/edit/<id>?notice=review|published|saved|withdrawn|publish-failed` (messages in `EDIT_NOTICES`, `src/app/edit/[id]/page.tsx`). `withdrawArticle` moves a story in review back to draft. The form submits only on button clicks: Enter in a text input is blocked, because the first submit button is Publish. The FormData includes the clicked button (`new FormData(form, submitter)`).
- **Limit errors:** DB rate limits raise SQLSTATE `PT429` (PostgREST returns HTTP 429) with a user-facing message: 5 submissions per 24 hours, 20 open drafts.
- **Site-wide notices:** `AccountBanner` (client, in the layout) shows suspension or "review and accept" (to `/account/agreements`).

## Domain rules
- **Roles:** `user` (default), `moderator`, `admin` on `profiles.role`. "Contributor" is not a role: any verified, non-suspended user who accepts the Contributor Agreement can write.
- **Suspension:** `profiles.suspended_until` (`'infinity'` = ban). Suspended or unverified users can read but not write anything (articles, comments, reactions, follows, reports, or their own profile). They can still delete their account.
- **New-contributor review:** an author with fewer than 3 approved articles (`profiles.approved_article_count < 3`) submits to `pending_review`; staff approve or reject. After that, publishing goes straight to `published`. Enforced in the DB (`can_publish_directly()`), not only the UI.
- **Article status:** `draft | pending_review | published | hidden | archived`, plus `deleted_at` for soft delete. Only `published` and not-deleted articles are visible to non-staff (authors also see their own).
- **Revisions:** any update to an article after it has been published snapshots the previous title/dek/body into `article_revisions` (trigger). Staff can view them.
- **Corrections:** authors (or staff) append corrections; they render as a dated box on the article.
- **Engagement:** likes only in v1 (no dislikes). The `reactions.kind` enum exists so dislikes can be added later. Counts are computed from rows, never stored as the source of truth.
- **Ranking (Top Stories):** score = (likes + 2·comments + views/25) / (hours_since_publish + 2)^1.5 over a 7-day window. SQL function `top_stories`; mirrored in `src/lib/ranking.ts`.

## Coding rules
- TypeScript strict, no `any`. Generated DB types in `src/lib/supabase/types.ts`; regenerate after every migration.
- **Security lives in the database.** Every table has RLS enabled with explicit policies. UI checks are convenience only. Never use the service-role key in code that runs per user request, except the self-service account-deletion route (which must verify the caller is deleting themselves). Otherwise service role is only for admin scripts and CI.
- Use SQL helpers in policies (all `security definer`, `set search_path = ''`): `public.is_staff()`, `public.is_admin()`, `public.is_suspended()`, `public.can_write()` (signed in, not suspended, 18+ attested, accepted the current Terms and Privacy), `public.can_publish_directly()` (≥ 3 approved stories, or staff), `public.current_role_name()`, `public.is_valid_handle(text)`, `public.current_agreement_version(kind)`, `public.has_accepted_current(kind)`, `public.can_edit_article(id)`, `public.can_view_article(id)`. Text helpers: `public.slugify(text)`, `public.richtext_plain(jsonb)`.
- Clients can never change `profiles.role`, `suspended_until`, `approved_article_count`, `id` or `created_at`: trigger `guard_profile_update` raises 42501 when `current_user` is `anon`/`authenticated`. Staff actions that change these must be `security definer` SQL functions (they run as the owner, pass the guard, and write `moderation_actions`), never direct client updates.
- Profiles are created only by the `on_auth_user_created` trigger from sign-up metadata (`handle`, `display_name`). An invalid or taken handle falls back to `user_<id>`, so sign-up never fails in the DB; the app validates and checks availability first.
- pgTAP tests simulate users with `set local role authenticated; set local request.jwt.claims to '{"sub":"<uuid>","role":"authenticated"}';` and create fixtures by inserting into `auth.users` (see `supabase/tests/010_profiles.test.sql`).
- Schema changes only via new files in `supabase/migrations/`. Never edit an applied migration.
- **User content is never raw HTML.** Article bodies are Tiptap JSON rendered to React by `src/lib/richtext` using an allowlist of node/mark types (paragraph, heading 2–3, bold, italic, link, bullet/ordered list, blockquote). Links get `rel="nofollow ugc noopener noreferrer"`, open in a new tab, and allow only `http(s):` URLs. Comments and bios are plain text. Never `dangerouslySetInnerHTML` user input.
  - Module `src/lib/richtext` (server-safe; import from `@/lib/richtext`): `sanitizeRichDoc(json)` rebuilds a doc from the allowlist (drops unknown nodes/marks/attrs, unsafe links, nesting > 8); `safeHref(url)` accepts only absolute `http(s)` without credentials; `<RichText doc />` re-sanitizes and renders (styled by `.richtext` in `globals.css`); `richTextToPlain` mirrors SQL `richtext_plain()`; `excerpt`, `isEmptyRichText`, `isWithinSizeLimit` (100 KB, same as the DB check).
  - Server Actions store `sanitizeRichDoc(input)`, never the raw client JSON.
  - Editor config: `editorExtensions` in `src/lib/richtext/extensions.ts` (client only, imports Tiptap; never import it from server code). A test keeps its schema identical to `ALLOWED_NODES`/`ALLOWED_MARKS`. Adding a node or mark means updating the schema, sanitizer, renderer, SQL `richtext_plain()` (new migration) and tests together.
- Every mutation: Zod validation → auth check → DB call → `revalidatePath` / `revalidateTag`.
- Rate limits enforced in Postgres (triggers or the RPC that performs the action), raising `PT429`: 5 article submissions/day (in `submit_article`), 20 open drafts, 60 comments/day, 30 reports/day per user.
- Staff actions (hide, restore, approve, reject, suspend, ban, role change, comment removal, lock comments, notes) always write a row to `moderation_actions` in the same transaction (SQL function).
- Accessible by default: semantic HTML, labels on inputs, 44px tap targets, visible focus, respects dark mode.
- Tests: mock `next/navigation` and `next-themes` with `vi.mock` + `vi.hoisted` (see `src/components/bottom-nav.test.tsx`); query by role/accessible name, not class names.
- Each feature ships with tests: unit/component tests for logic and UI, a pgTAP test for any new policy, and a Playwright test for the main happy path.
- Small PRs, one BUILD_PLAN step per PR. CI must be green before merge.

## Legal guardrails (product rules, not suggestions)
- Site copy calls it a "community board". Never "our reporting" or "our newsroom".
- Staff may hide, remove or restore content; they **do not rewrite user posts**. No admin "edit article" feature.
- Every publish requires ticking the **Contributor Agreement** checkbox. Store a row in `agreement_acceptances` (user, article, agreement version, timestamp, IP hash).
- **Agreement versioning:** Terms, Privacy and Contributor Agreement text lives in `src/content/legal.ts`; versions and SHA-256 hashes live in `src/content/agreements.ts` and in `public.agreement_versions`. Changing the text makes `pnpm test` fail until you bump the version, update the hash, and add a migration inserting the new row. A new Terms or Privacy version blocks writing until each user re-accepts (`can_write()`).
- **Acceptance records:** sign-up acceptances (Terms, Privacy, 18+) come from sign-up metadata via the `handle_new_user` trigger, because no session exists before email confirmation. Later acceptances are client inserts; a trigger forces owner, current version and `now()`. Rows are append-only. On account deletion `user_id` becomes null, so the record survives but is anonymized. IPs are stored only as `sha256(IP_HASH_SALT || ip)`.
- Byline on every post: "By {display_name} · Posted by a community member", plus the disclaimer that the views and claims are the author's and have not been independently verified by the site. Opinion pieces are labeled "Opinion".
- Report button on every article, comment and profile. Reported items enter the admin queue.
- Sign-up requires email verification, an "I am 18 or older" checkbox, and acceptance of Terms + Privacy (stored as acceptances).
- No anonymous posting. Display names shown; real names encouraged. Email is never shown publicly.
- Footer links: Terms, Privacy, Community Guidelines, Contributor Agreement, Corrections, Copyright/DMCA, Contact.
- No third-party copyrighted puzzles or content (e.g. LA Times crossword). Games, if ever, use our own content.
- No private messaging, no AI-generated news, no ads/sponsorships while on Vercel Hobby.
- Account deletion must actually delete or anonymize the user's data.
