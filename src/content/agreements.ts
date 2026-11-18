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
    version: 1,
    sha256: "bc7a6edcb0ad357ba0906780abc7f9ced54beb9d832ac22dafc839e60308bb7e",
  },
  privacy: {
    slug: "privacy",
    version: 1,
    sha256: "6f5e66b487b42b45e6c360acc72cf4e4a48c5d84fb068646b10d27f739abf83a",
  },
  contributor: {
    slug: "contributor-agreement",
    version: 1,
    sha256: "0734363b20cb4f8cf2ecd1b7a7c9ba64d0a212787a4827d5b8c933b5da913ec7",
  },
} as const satisfies Record<string, { slug: LegalSlug; version: number; sha256: string }>;

export type AgreementKind = keyof typeof AGREEMENTS;

