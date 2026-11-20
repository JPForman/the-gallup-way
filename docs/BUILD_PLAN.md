# Build plan

One step = one PR with tests; CI green before merge. Check items off as they land.

## Current status (update at the end of each session)
- **Done through 5.2.** Push `20261121010000_comments.sql` before merging (the home build calls `top_stories`, which now uses `comment_count`); check the dry run says "Remote database is up to date" before merging. Local: 291 pgTAP checks, 164 unit tests, 126 Playwright tests (2 desktop-only). `pnpm db:samples` includes likes and comments.
- **Next: 5.3 follows + Following feed.** `follows (follower_id default auth.uid(), followee_id, created_at, primary key (follower_id, followee_id), check follower <> followee)`. Who-follows-whom: decide privacy (suggest: follower counts public via a DEFINER `follow_counts(profile_id)`, rows readable only by the follower). `can_write()` to follow; unfollow own anytime. Explicit grants + `090` row. `feed_following(p_before_published_at, p_before_id, p_limit)` (SECURITY INVOKER, keyset like `feed_latest`, only stories by people the caller follows). UI: Follow button on `/u/[handle]` and the story byline (client, like LikeButton); Following tab on the home tabs → `/following` (dynamic, per user; signed out → sign-in prompt). pgTAP + e2e.
- **Owner to-dos:** 2.4 Resend SMTP needs a domain (cloud mailer sends ~2 emails/hour until then).

## Phase 1 — Foundation
- [x] 1.1 `git init`, scaffold Next.js (App Router, TS strict, Tailwind, ESLint), pnpm, `images.unoptimized`, `src/lib/site.ts`
- [x] 1.2 shadcn/ui setup, base layout (masthead, footer with legal links, mobile bottom nav), dark mode, legal page stubs
- [x] 1.3 Vitest + RTL config, first component test
- [x] 1.4 Supabase CLI init, local stack, `src/lib/supabase/{server,client,middleware}.ts`, `middleware.ts`
- [x] 1.5 Playwright config + smoke test; GitHub Actions CI (lint, typecheck, unit, `supabase test db`, e2e)
- [x] 1.6 Vercel project + Supabase cloud project linked; env vars documented in `.env.example`
  - [x] GitHub repo created (public) and pushed
  - [x] Supabase cloud project created (West US, `bhxfsxkczoonqrjhmoxx`) and CLI linked
  - [ ] Push migrations after each DB PR merges (`supabase db push`)
  - [x] Vercel project imported, env vars set → https://the-gallup-way.vercel.app

## Phase 2 — Auth and profiles
- [x] 2.1 Migration: `profiles`, role enum, helpers `is_staff/is_admin/is_suspended`, protection trigger, profile-on-signup trigger; pgTAP tests
- [x] 2.2 Migration: `agreement_versions`, `agreement_acceptances`; seed v1 Terms/Privacy/Contributor versions; pgTAP
- [x] 2.2b Re-accept prompt: when a signed-in user hasn't accepted the current Terms or Privacy, show a banner or page to re-accept (do with 2.3/2.5)
- [x] 2.3 Sign-up (18+, Terms+Privacy), sign-in, callback, reset, sign-out; Zod schemas; e2e with local Inbucket
- [x] 2.3b Cloud auth settings (operator, Supabase dashboard + Vercel):
  - [x] Authentication → URL Configuration: Site URL `https://the-gallup-way.vercel.app`; Redirect URLs `https://the-gallup-way.vercel.app/**`, `https://*-joshs-projects-127d9499.vercel.app/**` (previews), `http://localhost:3000/**`
  - [x] Authentication → Email Templates: paste `supabase/templates/confirmation.html` (Confirm signup) and `recovery.html` (Reset password), with the subjects from `config.toml`
  - [x] Authentication → Providers → Email: Confirm email ON, minimum password length 8, secure password change ON
  - [x] Vercel env var `IP_HASH_SALT` (random, `openssl rand -hex 32`), then redeploy
- [ ] 2.4 Resend as Supabase SMTP (cloud). Until then the default mailer sends only ~2 emails/hour
- [x] 2.5 Profile page `/u/[handle]`, settings page (edit profile, avatar upload with compression, Storage policies)

## Phase 3 — Publishing
- [x] 3.1 Migration: `categories` (+ seed), `articles`, `article_sources`, `article_images`, statuses, `can_publish_directly()`, rate-limit trigger; pgTAP (status RPCs `submit_article`/`withdraw_article`, `article-images` bucket)
- [x] 3.2 `src/lib/richtext`: Tiptap extension list + allowlist React renderer + plain-text extractor; unit tests incl. XSS cases
- [x] 3.3 Editor `/write`, `/edit/[id]`: drafts, images (compress, ≤3, caption/credit), sources
- [x] 3.4 Publish flow: Contributor Agreement checkbox → acceptance row → `pending_review` or `published`
- [x] 3.5 Migration: `article_revisions` trigger, `corrections`; author correction UI
- [x] 3.6 Article page `/a/[slug]`: byline, disclaimer, labels, images, sources, corrections; ISR + tags

## Phase 4 — News experience
- [x] 4.1 Home layout (lead + grid desktop, single column mobile), Latest feed, cursor pagination
- [x] 4.2 `article_views` daily aggregate + RPC; `top_stories` SQL function + `src/lib/ranking.ts` with tests
- [x] 4.3 Category pages `/c/[slug]`
- [x] 4.4 Search `/search` (full-text stories + writers)

## Phase 5 — Community
- [x] 5.1 Likes (reactions) + counts; pgTAP
- [x] 5.2 Comments (one-level replies, delete own, lock); rate limit; pgTAP
- [ ] 5.3 Follows + Following feed
- [ ] 5.4 Bookmarks + `/saved`
- [ ] 5.5 Contributor stats on profile

## Phase 6 — Safety and admin
- [ ] 6.1 Migration: `reports` (priority), `moderation_actions`, staff action SQL functions; pgTAP
- [ ] 6.2 Report button/dialog on articles, comments, profiles
- [ ] 6.3 `/admin` dashboard: stat tiles, Reports / Pending / New users / Log tabs, item drawer with actions
- [ ] 6.4 Suspend/ban, role change (admin), category management
- [ ] 6.5 Soft delete + restore; revision history view for staff
- [ ] 6.6 Account deletion (anonymize or delete) + e2e

## Phase 7 — Legal and launch prep
- [ ] 7.1 Final legal pages (Terms, Privacy, Guidelines, Contributor Agreement, Corrections, DMCA, Contact) — lawyer review recommended
- [ ] 7.2 Register DMCA designated agent at copyright.gov (operator task)
- [ ] 7.3 Accessibility pass (axe in Playwright), Lighthouse check
- [ ] 7.4 Security review (RLS audit, headers/CSP, service-role usage)
- [ ] 7.5 Weekly GitHub Actions ping to keep Supabase active; free-tier usage check
- [ ] 7.6 Domain + Resend DNS (SPF/DKIM) + production deploy

## Phase 8 — Beta and launch
- [ ] 8.1 Private beta with 10–20 contributors; collect feedback
- [ ] 8.2 Fix usability issues; open registration

## Later (not v1)
Notifications · weekly email newsletter · events calendar · tags · dislikes · original crossword · business directory.
