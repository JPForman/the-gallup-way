import { SITE_NAME } from "@/lib/site";

/**
 * Legal copy (step 7.1). Plain language on purpose. Not legal advice: have a
 * lawyer review before public launch (then set LEGAL_DRAFT = false in
 * src/lib/site.ts).
 *
 * Terms, Privacy Policy and Contributor Agreement are VERSIONED: changing
 * their text makes src/content/agreements.test.ts fail until you bump the
 * version in agreements.ts and add a migration (everyone then re-accepts).
 * Keep operator contact details out of them (they live in OPERATOR and are
 * shown on /contact and /legal/dmca).
 */
export type LegalSection = { heading: string; body: string[] };
export type LegalPage = { title: string; summary: string; updated: string; sections: LegalSection[] };

export const LEGAL_PAGES = {
  terms: {
    title: "Terms of Use",
    summary: `The rules for using ${SITE_NAME}, a community board for Gallup, New Mexico.`,
    updated: "2026-11-20",
    sections: [
      {
        heading: "What this site is",
        body: [
          `${SITE_NAME} is a community board. Stories, comments and profiles are written and posted by community members, not by the people who run the site (the "operator"). The operator does not write, edit or endorse what members post, and a post appearing here doesn't mean it has been checked for accuracy.`,
          "It is not a newspaper and does not employ reporters.",
        ],
      },
      {
        heading: "Who can use it",
        body: [
          "Anyone can read the site. To create an account you must be 18 or older, give a working email address, and agree to these Terms and the Privacy Policy. You must verify your email before you post.",
          "One person, one account. Don't impersonate anyone or post under someone else's name.",
          "Keep your password private. You're responsible for what happens under your account.",
        ],
      },
      {
        heading: "What you post",
        body: [
          "You keep ownership of what you write and the photos you upload. Publishing a story also means agreeing to the Contributor Agreement, which gives the site a license to show it.",
          "You are responsible for what you post. Follow the Community Guidelines. Don't post anything illegal, defamatory, threatening, harassing, or that you don't have the right to share.",
          "Comments and profiles are public. Likes are counted publicly, but who liked what is private. Who you follow and what you save are private.",
        ],
      },
      {
        heading: "Moderation",
        body: [
          "Staff review reports and enforce the Community Guidelines. They may hide or remove stories and comments, lock comments, and suspend or close accounts. Staff do not rewrite your posts.",
          "Every staff action is recorded with a reason. If you think a decision was wrong, use the Contact page.",
        ],
      },
      {
        heading: "Deleting your account",
        body: [
          "You can delete your account at any time from Settings. You choose whether your published stories stay up without your name or are deleted too. See the Privacy Policy for details.",
          "We may close accounts that break these Terms. Copies of public pages may remain in search engines or on other sites after something is deleted here.",
        ],
      },
      {
        heading: "No warranty; limits on liability",
        body: [
          `The site is provided "as is", without warranties of any kind. We don't promise it will always be available, error-free, or that member posts are accurate.`,
          "To the fullest extent the law allows, the operator is not liable for member posts, or for indirect or consequential damages from using the site. Nothing here limits rights that can't be limited by law.",
        ],
      },
      {
        heading: "Changes and governing law",
        body: [
          "When these Terms change in a meaningful way, we'll update the date above and ask you to accept the new version before you post again.",
          "These Terms are governed by the laws of the State of New Mexico.",
        ],
      },
    ],
  },
  privacy: {
    title: "Privacy Policy",
    summary: "What we collect, why, who helps us run the site, and how to delete it.",
    updated: "2026-11-20",
    sections: [
      {
        heading: "What we collect",
        body: [
          "Account details: your email address (never shown on the site), a handle, a display name, and an optional bio and photo. Passwords are handled by our sign-in provider; we never see them.",
          "What you post: stories, photos, sources, corrections, comments and reports.",
          "Your activity on the site: the stories you like (others see only the count), the people you follow and the stories you save (only you see these).",
          "Records of acceptance: when you accept the Terms, Privacy Policy or Contributor Agreement we store the version, the time and a one-way hash of your IP address, so we can show what you agreed to.",
          "Edit history: when you edit a story after publishing it, the earlier version is kept, and staff can see it.",
        ],
      },
      {
        heading: "What we don't collect",
        body: [
          "No home addresses, phone numbers, advertising trackers, or selling or renting your data.",
          "Story view counts are totals per day; we don't record who viewed what. Your browser remembers locally which stories it has counted, so a reload isn't counted twice.",
        ],
      },
      {
        heading: "Cookies and local storage",
        body: [
          "We use cookies only to keep you signed in. Your browser also stores small preferences, like dark mode and which stories it has counted as viewed. There are no advertising or tracking cookies.",
        ],
      },
      {
        heading: "Who helps us run the site",
        body: [
          "Supabase stores our database and photos and handles sign-in. Vercel hosts the website. An email provider sends account emails (confirmations and password resets). They process data only to provide these services to us.",
        ],
      },
      {
        heading: "Who can see what",
        body: [
          "Public: your handle, display name, bio, photo, published stories, comments, and follower and like counts.",
          "Private: your email, whom you follow, what you liked, what you saved, and reports you send (the person you report never sees who reported them).",
          "Staff (moderators and admins) can see reports, moderation history, edit history and account status, to keep the board safe. Staff can't see your password.",
        ],
      },
      {
        heading: "Deleting your account",
        body: [
          'Delete your account from Settings. Your profile, photo, likes, follows and saved stories are deleted. You choose what happens to your writing: keep published stories and comments up, credited to "Former member", or delete your stories and erase your comments.',
          "Some records are kept without your name, because the site needs them: the moderation log, reports you sent, and records of the agreements you accepted.",
          "Deleted data may stay in our providers' backups for a short time until they expire.",
        ],
      },
      {
        heading: "Age",
        body: ["The site is for adults 18 and older. We don't knowingly collect data from anyone younger."],
      },
      {
        heading: "Changes and questions",
        body: [
          "When this policy changes in a meaningful way, we'll update the date above and ask you to accept the new version. Questions: use the Contact page.",
        ],
      },
    ],
  },
  guidelines: {
    title: "Community Guidelines",
    summary: "How to post here so the board stays useful and fair for everyone in Gallup.",
    updated: "2026-11-20",
    sections: [
      {
        heading: "Be a good neighbor",
        body: [
          "No harassment, threats, hate, or personal attacks. Disagree with ideas, not people.",
          "Don't post other people's private information: home addresses, phone numbers, or anything they'd reasonably expect to stay private.",
        ],
      },
      {
        heading: "Facts and opinions",
        body: [
          "Write about what you know firsthand or can source. Mark opinion pieces as Opinion.",
          "Factual allegations, especially of crimes or misconduct, need credible sources linked in your story. Accusations of criminal conduct against private individuals without supporting evidence are not allowed.",
          "Got something wrong? Add a correction. It shows on your story with a date.",
        ],
      },
      {
        heading: "Original content only",
        body: [
          "Post your own writing, and photos you took or have permission to use. Don't copy articles from other news outlets; link to them and add your own reporting instead.",
        ],
      },
      {
        heading: "No spam",
        body: ["No advertising, scams, repeated posts, or links posted only to promote something."],
      },
      {
        heading: "How moderation works",
        body: [
          "Moderation follows these published rules, not popularity or viewpoint.",
          "Anyone signed in can report a story, comment or profile. Reports about threats, false claims about real people, and copyright are reviewed first.",
          "Depending on what happened, staff may remove a post, hide a story while it's reviewed, lock comments, or suspend an account (usually 7 or 30 days). Repeated or serious violations, including credible threats, lead to a ban. Threats of violence may be reported to law enforcement.",
          "Every staff action is logged with a reason. To appeal, use the Contact page.",
        ],
      },
    ],
  },
  "contributor-agreement": {
    title: "Contributor Agreement",
    summary: "What you agree to each time you publish a story.",
    updated: "2026-11-20",
    sections: [
      {
        heading: "By publishing, you confirm that",
        body: [
          "You wrote the story, and you own or have permission to publish everything in it, including photos and other media.",
          "You are responsible for the accuracy of your factual claims, and you've linked credible sources for any serious allegation.",
          "The story contains nothing defamatory, threatening, harassing or unlawful, to the best of your knowledge.",
          "You follow the Community Guidelines.",
        ],
      },
      {
        heading: "The license you give",
        body: [
          `You keep ownership. You grant ${SITE_NAME} a non-exclusive, royalty-free, worldwide license to host, display, distribute and promote your story (for example in feeds, search and social media previews), for as long as it's on the site.`,
          "The license ends when you delete the story or your account, except for copies already shared or cached elsewhere, and records kept for moderation or legal reasons.",
        ],
      },
      {
        heading: "Moderation and takedowns",
        body: [
          "Your first stories are reviewed by staff before they're published. Staff may hide, remove or restore stories under the Community Guidelines and the Copyright/DMCA policy, and may suspend or close accounts. Staff never rewrite your story.",
          "Edits you make after publishing are kept in a revision history that staff can see.",
        ],
      },
      {
        heading: "Your record of agreement",
        body: [
          "Each time you publish, we record that you accepted this agreement, which version, for which story, and when.",
        ],
      },
    ],
  },
  corrections: {
    title: "Corrections Policy",
    summary: "How mistakes are fixed and shown.",
    updated: "2026-11-20",
    sections: [
      {
        heading: "Corrections",
        body: [
          "Authors can add a correction to their own published story at any time. Corrections appear in a dated box on the story, so readers can see what changed.",
          "Stories edited after publishing show when they were last edited. Earlier versions are kept, and staff can see them.",
          "Staff may ask an author to correct a story. If a material error isn't corrected, staff may hide the story.",
        ],
      },
      {
        heading: "Mentioned in a story?",
        body: [
          "If you're named in a story and believe it's inaccurate, use the Report button on the story (reason: False claims about a real person) or the Contact page. Staff review these first. An unsupported factual allegation may be hidden while it's reviewed, and the author will be asked for sources or a correction.",
        ],
      },
    ],
  },
  dmca: {
    title: "Copyright and DMCA",
    summary: "How to report copyright infringement, and how counter-notices work.",
    updated: "2026-11-20",
    sections: [
      {
        heading: "Reporting infringement",
        body: [
          "If you believe something posted here infringes your copyright, use the Report button on it (reason: Copyright) or send a written notice to our designated agent (below). A notice should include:",
          "Your name and contact details, and your physical or electronic signature.",
          "The work you believe was infringed, and a link to the material on this site.",
          "A statement that you believe in good faith that the use isn't authorized by the owner, its agent, or the law.",
          "A statement, under penalty of perjury, that the notice is accurate and that you are the owner or authorized to act for the owner.",
        ],
      },
      {
        heading: "What happens next",
        body: [
          "On a valid notice we hide the material, tell the contributor, and log the action.",
          "The contributor may send a counter-notice if they believe it was removed by mistake. If they do, and the person who complained doesn't tell us within 10 to 14 business days that they've filed a lawsuit, we may restore it.",
          "Accounts with repeated valid notices are closed.",
        ],
      },
    ],
  },
} satisfies Record<string, LegalPage>;

export type LegalSlug = keyof typeof LEGAL_PAGES;

export function isLegalSlug(slug: string): slug is LegalSlug {
  return Object.hasOwn(LEGAL_PAGES, slug);
}
