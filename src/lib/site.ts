/** Single source of truth for site identity. Never hard-code the name elsewhere. */
export const SITE_NAME = "The Gallup Way";
export const SITE_TAGLINE = "A community board for Gallup";
export const SITE_LOCATION = "Gallup, NM";
export const SITE_TIMEZONE = "America/Denver";
export const SITE_DESCRIPTION =
  "Local stories posted by Gallup community members. A community board, not a newspaper.";

/**
 * Operator contact details shown on /contact and /legal/dmca (NOT inside the
 * versioned agreements, so filling them in doesn't force everyone to
 * re-accept). The owner fills these in before launch; pages say "listed here
 * before launch" while they're null.
 */
export const OPERATOR: {
  /** Public contact address for questions, disputes and account help. */
  contactEmail: string | null;
  /** DMCA designated agent, exactly as registered at copyright.gov (step 7.2). */
  dmcaAgent: { name: string; address: string; email: string; phone?: string } | null;
} = {
  contactEmail: "TheGallupWay@gmail.com",
  dmcaAgent: null,
};

/** Shows a "not reviewed by a lawyer yet" note on legal pages. Set to false after legal review. */
export const LEGAL_DRAFT = true;

export type NavLink = { href: string; label: string };

/** Footer legal links (required on every page; see CLAUDE.md Legal guardrails). */
export const LEGAL_LINKS: NavLink[] = [
  { href: "/legal/terms", label: "Terms" },
  { href: "/legal/privacy", label: "Privacy" },
  { href: "/legal/guidelines", label: "Community Guidelines" },
  { href: "/legal/contributor-agreement", label: "Contributor Agreement" },
  { href: "/legal/corrections", label: "Corrections" },
  { href: "/legal/dmca", label: "Copyright/DMCA" },
  { href: "/contact", label: "Contact" },
];

/**
 * Story categories, in display order. Mirrors the `categories` table
 * (migration 20261119010000_articles.sql); src/lib/site.test.ts keeps them in
 * sync. Kept here so the header needs no database read.
 */
export const CATEGORIES = [
  { slug: "news", name: "News" },
  { slug: "community", name: "Community" },
  { slug: "government", name: "Government" },
  { slug: "education", name: "Education" },
  { slug: "sports", name: "Sports" },
  { slug: "events", name: "Events" },
  { slug: "business", name: "Business" },
  { slug: "opinion", name: "Opinion" },
] as const;

export type CategorySlug = (typeof CATEGORIES)[number]["slug"];

export const NAV_CATEGORIES: NavLink[] = CATEGORIES.map((c) => ({
  href: `/c/${c.slug}`,
  label: c.name,
}));
