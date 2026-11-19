import StarterKit from "@tiptap/starter-kit";
import { HEADING_LEVELS } from "./schema";
import { safeHref } from "./sanitize";
import { UGC_LINK_REL } from "./render";

/**
 * Tiptap extensions for the article editor (client only). The resulting
 * schema must equal ALLOWED_NODES / ALLOWED_MARKS (checked by test), so the
 * editor can't produce content the renderer would drop.
 */
export const editorExtensions = [
  StarterKit.configure({
    heading: { levels: [...HEADING_LEVELS] },
    code: false,
    codeBlock: false,
    strike: false,
    underline: false,
    horizontalRule: false,
    link: {
      openOnClick: false,
      autolink: true,
      linkOnPaste: true,
      defaultProtocol: "https",
      protocols: [],
      isAllowedUri: (url) => safeHref(url) !== null,
      HTMLAttributes: { rel: UGC_LINK_REL, target: "_blank" },
    },
  }),
];
