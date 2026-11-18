# Build plan

One step = one PR with tests; CI green before merge. Check items off as they land.

## Phase 1 — Foundation
- [x] 1.1 `git init`, scaffold Next.js (App Router, TS strict, Tailwind, ESLint), pnpm, `images.unoptimized`, `src/lib/site.ts`
- [x] 1.2 shadcn/ui setup, base layout (masthead, footer with legal links, mobile bottom nav), dark mode, legal page stubs
- [x] 1.3 Vitest + RTL config, first component test
- [ ] 1.4 Supabase CLI init, local stack, `src/lib/supabase/{server,client,middleware}.ts`, `middleware.ts`
- [ ] 1.5 Playwright config + smoke test; GitHub Actions CI (lint, typecheck, unit, `supabase test db`, e2e)
- [ ] 1.6 Vercel project + Supabase cloud project linked; env vars documented in `.env.example`

## Phase 2 — Auth and profiles
- [ ] 2.1 Migration: `profiles`, role enum, helpers `is_staff/is_admin/is_suspended`, protection trigger, profile-on-signup trigger; pgTAP tests
- [ ] 2.2 Migration: `agreement_versions`, `agreement_acceptances`; seed v1 Terms/Privacy/Contributor versions; pgTAP
- [ ] 2.3 Sign-up (18+, Terms+Privacy), sign-in, callback, reset, sign-out; Zod schemas; e2e with local Inbucket
- [ ] 2.4 Resend as Supabase SMTP (cloud) + email templates
- [ ] 2.5 Profile page `/u/[handle]`, settings page (edit profile, avatar upload with compression, Storage policies)

## Phase 3 — Publishing
- [ ] 3.1 Migration: `categories` (+ seed), `articles`, `article_sources`, `article_images`, statuses, `can_publish_directly()`, rate-limit trigger; pgTAP
- [ ] 3.2 `src/lib/richtext`: Tiptap extension list + allowlist React renderer + plain-text extractor; unit tests incl. XSS cases
- [ ] 3.3 Editor `/write`, `/edit/[id]`: drafts, images (compress, ≤3, caption/credit), sources
- [ ] 3.4 Publish flow: Contributor Agreement checkbox → acceptance row → `pending_review` or `published`
- [ ] 3.5 Migration: `article_revisions` trigger, `corrections`; author correction UI
- [ ] 3.6 Article page `/a/[slug]`: byline, disclaimer, labels, images, sources, corrections; ISR + tags

## Phase 4 — News experience
- [ ] 4.1 Home layout (lead + grid desktop, single column mobile), Latest feed, cursor pagination
- [ ] 4.2 `article_views` daily aggregate + RPC; `top_stories` SQL function + `src/lib/ranking.ts` with tests
- [ ] 4.3 Category pages `/c/[slug]`
- [ ] 4.4 Search `/search` (full-text stories + writers)

## Phase 5 — Community
- [ ] 5.1 Likes (reactions) + counts; pgTAP
- [ ] 5.2 Comments (one-level replies, delete own, lock); rate limit; pgTAP
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
