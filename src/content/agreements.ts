import type { LegalSlug } from "./legal";

/**
 * Versioned agreements users accept. Each entry must match a row in
 * public.agreement_versions (inserted by a migration).
 *
 * To change agreement text:
 *   1. Edit src/content/legal.ts.
 *   2. `pnpm test` (src/content/agreements.test.ts) fails with the new hash. Bump `version`, paste the new hash.
 *   3. Add a migration inserting (kind, version, text_sha256).
 * Everyone must then re-accept before they can post again.
 */
export const AGREEMENTS = {
  terms: {
    slug: "terms",
    version: 2,
    sha256: "35eca39860160b22b1c7b602f94fd08fc0ef9d29b1c9e62da17403757b9ce38f",
  },
  privacy: {
    slug: "privacy",
    version: 2,
    sha256: "44965e716a0c3050745d7e2aec103188b647ddc71b770c430354d548c5d06420",
  },
  contributor: {
    slug: "contributor-agreement",
    version: 2,
    sha256: "7b1ec3090f4f286aaff4734bcbc2e4f7ff12b3553f6d36985f0b179078f48d52",
  },
} as const satisfies Record<string, { slug: LegalSlug; version: number; sha256: string }>;

export type AgreementKind = keyof typeof AGREEMENTS;

