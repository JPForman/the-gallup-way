/** Single source of truth for site identity. Never hard-code the name elsewhere. */
export const SITE_NAME = "The Gallup Way";
export const SITE_TAGLINE = "A community board for Gallup";
export const SITE_LOCATION = "Gallup, NM";
export const SITE_TIMEZONE = "America/Denver";
export const SITE_DESCRIPTION =
  "Local stories posted by Gallup community members. A community board, not a newspaper.";

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
 * Placeholder category strip. Replaced by the `categories` table in step 3.1;
 * keep slugs in sync with supabase/seed.sql when that lands.
 */
export const NAV_CATEGORIES: NavLink[] = [
  { href: "/c/news", label: "News" },
  { href: "/c/community", label: "Community" },
  { href: "/c/government", label: "Government" },
  { href: "/c/education", label: "Education" },
  { href: "/c/sports", label: "Sports" },
  { href: "/c/events", label: "Events" },
  { href: "/c/business", label: "Business" },
  { href: "/c/opinion", label: "Opinion" },
];
