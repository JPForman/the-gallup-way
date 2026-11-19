import { Fragment, type ReactNode } from "react";
import { sanitizeRichDoc } from "./sanitize";
import type { BlockNode, InlineNode, TextNode } from "./schema";

/** rel for every user-supplied link. */
export const UGC_LINK_REL = "nofollow ugc noopener noreferrer";

function renderText(node: TextNode, key: number): ReactNode {
  // React escapes the string, so "<script>" stays text.
  let el: ReactNode = node.text;
  for (const mark of node.marks ?? []) {
    if (mark.type === "bold") el = <strong>{el}</strong>;
    else if (mark.type === "italic") el = <em>{el}</em>;
    else if (mark.type === "link") {
      el = (
        <a href={mark.attrs.href} rel={UGC_LINK_REL} target="_blank">
          {el}
        </a>
      );
    }
  }
  return <Fragment key={key}>{el}</Fragment>;
}

function renderInline(nodes: InlineNode[] | undefined): ReactNode[] {
  return (nodes ?? []).map((n, i) => (n.type === "hardBreak" ? <br key={i} /> : renderText(n, i)));
}

function renderBlocks(nodes: BlockNode[]): ReactNode[] {
  return nodes.map((n, i) => {
    switch (n.type) {
      case "paragraph":
        return <p key={i}>{renderInline(n.content)}</p>;
      case "heading":
        return n.attrs.level === 2 ? (
          <h2 key={i}>{renderInline(n.content)}</h2>
        ) : (
          <h3 key={i}>{renderInline(n.content)}</h3>
        );
      case "bulletList":
        return (
          <ul key={i}>
            {n.content.map((item, j) => (
              <li key={j}>{renderBlocks(item.content)}</li>
            ))}
          </ul>
        );
      case "orderedList":
        return (
          <ol key={i} start={n.attrs?.start}>
            {n.content.map((item, j) => (
              <li key={j}>{renderBlocks(item.content)}</li>
            ))}
          </ol>
        );
      case "blockquote":
        return <blockquote key={i}>{renderBlocks(n.content)}</blockquote>;
    }
  });
}

/**
 * Renders a stored article body. Input is always re-sanitized, so only
 * allowlisted elements can appear. Never uses dangerouslySetInnerHTML.
 * Styling comes from the `.richtext` rules in globals.css.
 */
export function RichText({ doc, className }: { doc: unknown; className?: string }) {
  const clean = sanitizeRichDoc(doc);
  return (
    <div className={className ? `richtext ${className}` : "richtext"}>{renderBlocks(clean.content)}</div>
  );
}
