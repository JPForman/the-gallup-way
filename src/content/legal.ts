import { SITE_NAME } from "@/lib/site";

/**
 * Draft legal copy. Final text lands in BUILD_PLAN step 7.1 after legal review.
 * Bump the matching agreement version (agreement_versions table) whenever the
 * Terms, Privacy Policy or Contributor Agreement text changes.
 */
export type LegalSection = { heading: string; body: string[] };
export type LegalPage = { title: string; summary: string; sections: LegalSection[] };

export const LEGAL_PAGES = {
  terms: {
    title: "Terms of Use",
    summary: `The rules for using ${SITE_NAME}, a community board for Gallup.`,
    sections: [
      {
        heading: "What this site is",
        body: [
          `${SITE_NAME} is a community board. Stories and comments are written and posted by community members, not by the site operator. The operator does not write, edit or endorse user posts.`,
        ],
      },
      {
        heading: "Who can use it",
        body: [
          "You must be 18 or older to create an account. You must verify your email address before posting.",
        ],
      },
      {
        heading: "Your responsibilities",
        body: [
          "You are responsible for what you post. Follow the Community Guidelines and, when you publish a story, the Contributor Agreement.",
        ],
      },
      {
        heading: "Moderation",
        body: [
          "Staff may hide or remove content and suspend or close accounts that break these rules. Staff do not rewrite your posts.",
        ],
      },
    ],
  },
  privacy: {
    title: "Privacy Policy",
    summary: "What we collect, why, and how to delete it.",
    sections: [
      {
        heading: "What we collect",
        body: [
          "Your email address (kept private), a handle, a display name, and an optional bio and photo. Passwords are handled by our authentication provider and are never visible to us.",
          "When you accept an agreement we store a one-way hash of your IP address with the time and agreement version, as a record of acceptance.",
        ],
      },
      {
        heading: "What we don't collect",
        body: ["No home addresses, phone numbers, advertising trackers or data sales."],
      },
      {
        heading: "Deleting your account",
        body: [
          "You can delete your account from Settings. Your personal data is deleted, and your posts are either deleted or anonymized, as you choose.",
        ],
      },
    ],
  },
  guidelines: {
    title: "Community Guidelines",
    summary: "How to post here so the board stays useful and fair.",
    sections: [
      {
        heading: "Be a good neighbor",
        body: [
          "No harassment, threats, hate, or personal attacks. Disagree with ideas, not people.",
        ],
      },
      {
        heading: "Facts and opinions",
        body: [
          "Opinions are welcome and labeled as opinion. Factual allegations, especially of crimes or misconduct, require credible sources linked in your story. Accusations of criminal conduct against private individuals without supporting evidence are not allowed.",
        ],
      },
      {
        heading: "Original content only",
        body: [
          "Post your own writing and photos you took or have permission to use. Don't copy articles from other news outlets.",
        ],
      },
      {
        heading: "No spam",
        body: ["No advertising, repeated posts, or links posted only for promotion."],
      },
      {
        heading: "How moderation works",
        body: [
          "Moderation follows these published rules, not popularity or viewpoint. Reported posts may be hidden while they are reviewed. Repeated violations lead to suspension or a ban.",
        ],
      },
    ],
  },
  "contributor-agreement": {
    title: "Contributor Agreement",
    summary: "What you agree to each time you publish a story.",
    sections: [
      {
        heading: "By publishing, you confirm that",
        body: [
          "You own the content, or have permission to publish it, including any photos and other media.",
          "You are responsible for the accuracy of your factual claims.",
          "You will not knowingly publish defamatory, threatening, harassing or unlawful material.",
          `You grant ${SITE_NAME} a non-exclusive license to display, distribute and promote your submission.`,
          "Deleting a story here may not remove copies that others have already shared elsewhere.",
          "You accept the moderation and takedown policies, and understand your account can be suspended or terminated.",
        ],
      },
    ],
  },
  corrections: {
    title: "Corrections Policy",
    summary: "How mistakes are fixed and shown.",
    sections: [
      {
        heading: "Corrections",
        body: [
          "Authors can add a correction to their own story at any time. Corrections appear in a dated box on the story.",
          "Changes made after a story is published are kept in a revision history.",
          "If a material error isn't corrected, staff may hide the story.",
        ],
      },
      {
        heading: "Mentioned in a story?",
        body: [
          "If you are named in a story and believe it is inaccurate, use the report button on the story or the Contact page.",
        ],
      },
    ],
  },
  dmca: {
    title: "Copyright and DMCA",
    summary: "How to report copyright infringement.",
    sections: [
      {
        heading: "Reporting infringement",
        body: [
          "If you believe content here infringes your copyright, use the report button (reason: Copyright) or send a notice to our designated agent. Designated agent details will be listed here before launch.",
        ],
      },
      {
        heading: "What happens next",
        body: [
          "On a valid notice we hide the content and notify the contributor, who may submit a counter-notice. Accounts with repeated valid notices are closed.",
        ],
      },
    ],
  },
} satisfies Record<string, LegalPage>;

export type LegalSlug = keyof typeof LEGAL_PAGES;

export function isLegalSlug(slug: string): slug is LegalSlug {
  return Object.hasOwn(LEGAL_PAGES, slug);
}
