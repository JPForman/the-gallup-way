# CLAUDE.md — The Gallup Way (community news board)

Read this file at the start of every session. The product spec is `docs/PRD.md`, the phased task list is `docs/BUILD_PLAN.md`, and moderation/legal policy is `docs/MODERATION.md`.

On commit make sure to update the Claude.md and docs as needed.

## What this is
A free, mobile-first **community board** for local Gallup stories, run by one person on $0/month. Residents post stories; everyone reads them in a clean, newspaper-style layout; readers like, comment, follow writers and bookmark stories. It should feel like a legitimate local publication, not Reddit or Facebook: strong headlines, categories, clean typography, no outrage mechanics.

It is **not a newspaper**: the operator does not write, edit or endorse user posts. Keep it that way in code and copy (see Legal guardrails).

The site name lives in one constant: `src/lib/site.ts` → `SITE_NAME = "The Gallup Way"`. Never hard-code the name elsewhere. Footer legal links (`LEGAL_LINKS`) and the placeholder category strip (`NAV_CATEGORIES`, replaced by the DB in step 3.1) live there too.

## Stack (do not swap without asking)
| Concern | Choice | Notes |
|---|---|---|
| Framework | Next.js 15 (App Router) + React + TypeScript (strict) | Server Components by default, Server Actions for mutations |
| Styling | Tailwind CSS | Mobile-first: design at 375px, then scale up |
| UI parts | shadcn/ui (copy-in components, `src/components/ui`) | No heavy UI kits. `cn()` = `clsx` + `tailwind-merge` in `src/lib/utils.ts` |
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
- Work on a `step-X.Y-…` branch, then PR to `main` once CI is green. Commits use the GitHub noreply email set in this repo's local git config. Never commit with a personal email.

## CI (`.github/workflows/ci.yml`)
- `checks` job: lint, typecheck, unit tests.
- `integration` job: starts local Supabase, fails if `src/lib/supabase/types.ts` is stale (run `pnpm db:types` and commit), runs pgTAP, builds, runs Playwright (report uploaded on failure).
- Runners pinned to `ubuntu-24.04`: `ubuntu-latest` is 26.04, which Playwright 1.56 doesn't support. Unpin after a Playwright upgrade.
- Node 22 in CI. Local Node 20 still works, but Node 20 reached end-of-life in April 2026, so upgrade to 22 or 24 LTS.
- Every e2e page check includes an axe accessibility scan in light and dark mode (`e2e/smoke.spec.ts`); new pages should be added to that list.

## Environment
- `.env.local` (git-ignored; template in `.env.example`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. Local values: `pnpm exec supabase status -o env`.
- Public env is validated by Zod in `src/lib/env.ts` (`getPublicEnv()`, lazy). In dev, middleware skips session refresh if Supabase isn't configured; in production a missing var throws.
- Supabase clients: `src/lib/supabase/server.ts` (Server Components/Actions, `server-only`), `client.ts` (Client Components), `middleware.ts` (`updateSession`, called by `src/middleware.ts`; matcher skips static assets and `/legal/*` to save invocations).
- Known harmless build warning: supabase-js references `process.version(s)` in the Edge runtime (guarded in the library).
- pnpm only runs install scripts for packages in `package.json` → `pnpm.onlyBuiltDependencies` (currently `supabase`, which downloads the CLI binary).

## Domain rules
- **Roles:** `user` (default), `moderator`, `admin` on `profiles.role`. "Contributor" is not a role: any verified, non-suspended user who accepts the Contributor Agreement can write.
- **Suspension:** `profiles.suspended_until` (a far-future date = ban). Suspended or unverified users can read but not write anything (articles, comments, reactions, follows, reports).
- **New-contributor review:** an author with fewer than 3 approved articles (`profiles.approved_article_count < 3`) submits to `pending_review`; staff approve or reject. After that, publishing goes straight to `published`. Enforced in the DB (`can_publish_directly()`), not only the UI.
- **Article status:** `draft | pending_review | published | hidden | archived`, plus `deleted_at` for soft delete. Only `published` and not-deleted articles are visible to non-staff (authors also see their own).
- **Revisions:** any update to an article after it has been published snapshots the previous title/dek/body into `article_revisions` (trigger). Staff can view them.
- **Corrections:** authors (or staff) append corrections; they render as a dated box on the article.
- **Engagement:** likes only in v1 (no dislikes). The `reactions.kind` enum exists so dislikes can be added later. Counts are computed from rows, never stored as the source of truth.
- **Ranking (Top Stories):** score = (likes + 2·comments + views/25) / (hours_since_publish + 2)^1.5 over a 7-day window. SQL function `top_stories`; mirrored in `src/lib/ranking.ts`.

## Coding rules
- TypeScript strict, no `any`. Generated DB types in `src/lib/supabase/types.ts`; regenerate after every migration.
- **Security lives in the database.** Every table has RLS enabled with explicit policies. UI checks are convenience only. Never use the service-role key in code that runs per user request, except the self-service account-deletion route (which must verify the caller is deleting themselves). Otherwise service role is only for admin scripts and CI.
- Use SQL helpers `public.is_staff()`, `public.is_admin()`, `public.is_suspended()`, `public.can_publish_directly()` in policies. A user can never change their own `role`, `suspended_until` or `approved_article_count` (trigger).
- Schema changes only via new files in `supabase/migrations/`. Never edit an applied migration.
- **User content is never raw HTML.** Article bodies are Tiptap JSON rendered to React by `src/lib/richtext` using an allowlist of node/mark types (paragraph, heading 2–3, bold, italic, link, bullet/ordered list, blockquote). Links get `rel="nofollow ugc noopener"` and only `http(s):` URLs. Comments and bios are plain text. Never `dangerouslySetInnerHTML` user input.
- Every mutation: Zod validation → auth check → DB call → `revalidatePath` / `revalidateTag`.
- Rate limits enforced in Postgres via triggers: 5 articles/day, 60 comments/day, 30 reports/day per user.
- Staff actions (hide, restore, approve, reject, suspend, ban, role change, comment removal, lock comments, notes) always write a row to `moderation_actions` in the same transaction (SQL function).
- Accessible by default: semantic HTML, labels on inputs, 44px tap targets, visible focus, respects dark mode.
- Tests: mock `next/navigation` and `next-themes` with `vi.mock` + `vi.hoisted` (see `src/components/bottom-nav.test.tsx`); query by role/accessible name, not class names.
- Each feature ships with tests: unit/component tests for logic and UI, a pgTAP test for any new policy, and a Playwright test for the main happy path.
- Small PRs, one BUILD_PLAN step per PR. CI must be green before merge.

## Legal guardrails (product rules, not suggestions)
- Site copy calls it a "community board". Never "our reporting" or "our newsroom".
- Staff may hide, remove or restore content; they **do not rewrite user posts**. No admin "edit article" feature.
- Every publish requires ticking the **Contributor Agreement** checkbox. Store a row in `agreement_acceptances` (user, article, agreement version, timestamp, IP hash). If the agreement text changes, bump the version.
- Byline on every post: "By {display_name} · Posted by a community member", plus the disclaimer that the views and claims are the author's and have not been independently verified by the site. Opinion pieces are labeled "Opinion".
- Report button on every article, comment and profile. Reported items enter the admin queue.
- Sign-up requires email verification, an "I am 18 or older" checkbox, and acceptance of Terms + Privacy (stored as acceptances).
- No anonymous posting. Display names shown; real names encouraged. Email is never shown publicly.
- Footer links: Terms, Privacy, Community Guidelines, Contributor Agreement, Corrections, Copyright/DMCA, Contact.
- No third-party copyrighted puzzles or content (e.g. LA Times crossword). Games, if ever, use our own content.
- No private messaging, no AI-generated news, no ads/sponsorships while on Vercel Hobby.
- Account deletion must actually delete or anonymize the user's data.
