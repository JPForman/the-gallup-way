# The Gallup Way — Product Requirements

## 1. Vision
Gallup lost its local newspaper. The Gallup Way is the place residents check every morning to answer: *What is happening in our community, and where can I find reliable information about it?*

It is a **community board**: residents write, the operator hosts and moderates. It should look and read like a real local publication (headlines, categories, bylines, clean typography) and avoid social-media dynamics (no viral mechanics, no anonymous drive-bys, no outrage rewards).

### Goals
1. Operating cost ≈ $0/month (plus a domain).
2. Moderation manageable by one person in minutes per day.
3. Legal exposure minimized by design (clear authorship, contributor agreement, reporting, audit log, DMCA process).

### Audience
Adults (18+) living in or connected to Gallup: residents who want to know what's going on, and people who follow city government, schools, sports, businesses, and events and want to share it.

## 2. User roles (RBAC matrix)
| Capability | Visitor | User (verified) | Moderator | Admin |
|---|---|---|---|---|
| Read published stories, profiles, comments | ✓ | ✓ | ✓ | ✓ |
| Search | ✓ | ✓ | ✓ | ✓ |
| Like, comment, follow, bookmark, report | | ✓ | ✓ | ✓ |
| Write / edit / unpublish / soft-delete **own** articles | | ✓ | ✓ | ✓ |
| Add corrections to own articles | | ✓ | ✓ | ✓ |
| Edit own profile, delete own account | | ✓ | ✓ | ✓ |
| See admin queue, reports, revision history | | | ✓ | ✓ |
| Approve/reject pending stories | | | ✓ | ✓ |
| Hide/restore articles, remove comments, lock comments | | | ✓ | ✓ |
| Suspend users | | | ✓ | ✓ |
| Ban users, change roles, manage categories | | | | ✓ |
| Edit another user's article | | | ✗ never | ✗ never |

Suspended or unverified users have Visitor capabilities plus deleting their account. Suspended users cannot edit their profile, which stops banned spammers from rewriting their bios.

## 3. User stories (v1)
**Reader**
- I can open the site on my phone and see today's top local stories with headline, category, author and time.
- I can switch between Top Stories, Latest, and Following, and browse a category.
- I can search stories and authors.
- I can read an article with images, captions, credits, sources, and any corrections.
- I can like, comment (and reply once), bookmark, and follow the writer.
- I can report an article, comment or profile with a reason.

**Contributor**
- I can write a story with a headline, short summary (dek), category, content type, formatted body, up to 3 photos with caption and credit, and source links.
- I can save drafts and come back later.
- Before publishing I must accept the Contributor Agreement.
- My first 3 stories are reviewed before they go live; I can see "Pending review" status.
- I can edit my published story (history is kept), add a correction, unpublish or delete it.
- My profile shows my bio, photo, member-since date, published stories and number of corrections.

**Operator (admin/moderator)**
- I open `/admin` and see counts: open reports, pending stories, new users this week.
- I work a queue: high-priority reports first (defamation, threats, copyright), then pending stories.
- One tap to hide, restore, approve, reject, remove a comment, lock comments, suspend or ban, each with a reason. Everything is logged.
- I can see an item's report reasons, the author's history, and prior moderation actions.

## 4. Functional requirements
### Accounts
- Email + password via Supabase Auth; email verification required to write.
- Sign-up fields: email, password, display name, handle; checkboxes: 18+, Terms + Privacy.
- Password reset by email. Emails sent through Resend SMTP.
- Settings: edit display name, handle, bio, avatar; delete account (choose anonymize or delete content).

### Articles
- Fields: title (≤ 120), dek (≤ 240), category, content type (News, Community, Opinion, Event, Sports, Business), body (Tiptap JSON), images (≤ 3), sources (≤ 10 URLs with label).
- Editor formatting: H2, H3, paragraph, bold, italic, link, bullet/numbered list, blockquote. Images are attached separately with caption and credit (not inline) in v1.
- Statuses: draft → pending_review / published → hidden (staff) / archived (author unpublish); soft delete via `deleted_at`.
- Slug generated from title + short id; stable after first publish.
- Serious allegations (crimes, misconduct) require at least one source — enforced as copy/guidance plus a checkbox "This story makes no accusations of wrongdoing, or I have included sources"; moderators enforce on report.

### Feeds and discovery
- Top Stories: SQL ranking (see CLAUDE.md), 7-day window.
- Latest: chronological.
- Following: followed writers, chronological (signed-in only).
- Category pages: chronological.
- Search: Postgres full-text over title, dek, body text; author search by display name/handle.
- All lists: cursor pagination, 20 per page, "Load more" button (no infinite scroll).

### Community
- Likes (one per user per article, toggle).
- Comments: plain text ≤ 2,000 chars, one level of replies, author can delete own, staff can hide; article-level lock.
- Follows, bookmarks (Saved page).

### Moderation
- Report reasons: defamation/false allegation, harassment, copyright, spam, threat/violence, other (+ details). Priority: threat/defamation/copyright = high.
- Queue tabs: Reports, Pending review, New users, Log.
- All actions recorded in `moderation_actions` (append-only).

### Legal pages
Terms, Privacy, Community Guidelines, Contributor Agreement, Corrections Policy, Copyright/DMCA, Contact. All linked in the footer.

## 5. Non-functional requirements
- Mobile-first; design at 375px; Lighthouse mobile performance ≥ 90 on feed and article.
- Accessible (WCAG 2.1 AA target): semantic HTML, labels, 44px targets, focus rings, dark mode.
- Stay inside free tiers (see CLAUDE.md budget rules).
- Security enforced by RLS; pgTAP tests for every policy.
- Privacy: collect only email, handle, display name, optional bio/photo. IPs stored only as salted hashes on agreement acceptances.

## 6. Page-by-page UI
- **Header:** masthead "The Gallup Way" with date line ("WEDNESDAY, NOVEMBER 18 · GALLUP, NM"), category strip (horizontal scroll on mobile).
- **Home `/`:** tabs Top / Latest / Following. Desktop: lead story (large image, headline, dek) + 3-column grid; mobile: single column of cards (category label, headline, byline, time, like count, thumbnail).
- **Article `/a/[slug]`:** category + content-type label ("COMMUNITY REPORT", "OPINION"), headline, dek, byline + "Posted by a community member", date, images with captions/credits, body, sources list, corrections box, disclaimer, like/bookmark/share/report, follow author, comments.
- **Write `/write`, Edit `/edit/[id]`:** form with live character counts, toolbar, image picker (compress client-side), sources list, Save draft, Publish (opens agreement checkbox).
- **Profile `/u/[handle]`:** avatar, name, bio, member since, stats, follow button, list of published stories.
- **Search `/search`:** query box, Stories / Writers tabs.
- **Saved `/saved`:** bookmarked stories.
- **Settings `/settings`:** profile fields, delete account.
- **Admin `/admin`:** stat tiles + queue tabs; item detail drawer with actions and history.
- **Mobile bottom nav:** Home, Search, Write (prominent center button), Saved, Profile.
- **Footer:** legal links, "A community board for Gallup" tagline.

## 7. Out of scope (v1)
| Feature | Decision |
|---|---|
| Dislikes | Postponed |
| Notifications, weekly newsletter | Postponed (Phase 2) |
| Events calendar, tags, business directory, classifieds, polls | Postponed |
| Crossword / puzzles | Postponed; original content only, never third-party |
| Inline images in body, video, podcasts | Postponed |
| Private messaging | Won't build |
| Anonymous posting | Won't build |
| AI-generated news | Won't build |
| Advertising / sponsored posts | Not while on Vercel Hobby |
| Multiple communities | Single community (Gallup) |

## 8. Launch plan
Private beta with 10–20 recruited contributors (city government, schools, sports, business, community happenings), plus local organizations (library, schools, nonprofits) posting announcements. Then open registration.
