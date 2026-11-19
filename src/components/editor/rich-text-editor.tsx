"use client";

import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import { Bold, Heading2, Heading3, Italic, Link2, List, ListOrdered, Quote, Unlink } from "lucide-react";
import { useId, useState, type ComponentType } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { editorExtensions } from "@/lib/richtext/extensions";
import { safeHref } from "@/lib/richtext";
import { cn } from "@/lib/utils";

type ToolProps = {
  label: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
};

function Tool({ label, icon: Icon, active, disabled, onClick }: ToolProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()} // keep the editor's selection
      onClick={onClick}
      className={cn(
        "inline-flex size-11 items-center justify-center rounded-md text-foreground hover:bg-muted disabled:opacity-40",
        active && "bg-muted text-brand",
      )}
    >
      <Icon className="size-5" aria-hidden />
    </button>
  );
}

function Toolbar({ editor, onLink }: { editor: Editor; onLink: () => void }) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      h2: e.isActive("heading", { level: 2 }),
      h3: e.isActive("heading", { level: 3 }),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      quote: e.isActive("blockquote"),
      link: e.isActive("link"),
    }),
  });
  const chain = () => editor.chain().focus();
  return (
    <div role="toolbar" aria-label="Formatting" className="flex flex-wrap gap-0.5 border-b border-border p-1">
      <Tool label="Bold" icon={Bold} active={s.bold} onClick={() => chain().toggleBold().run()} />
      <Tool label="Italic" icon={Italic} active={s.italic} onClick={() => chain().toggleItalic().run()} />
      <Tool label="Heading" icon={Heading2} active={s.h2} onClick={() => chain().toggleHeading({ level: 2 }).run()} />
      <Tool label="Subheading" icon={Heading3} active={s.h3} onClick={() => chain().toggleHeading({ level: 3 }).run()} />
      <Tool label="Bulleted list" icon={List} active={s.bullet} onClick={() => chain().toggleBulletList().run()} />
      <Tool label="Numbered list" icon={ListOrdered} active={s.ordered} onClick={() => chain().toggleOrderedList().run()} />
      <Tool label="Quote" icon={Quote} active={s.quote} onClick={() => chain().toggleBlockquote().run()} />
      <Tool label="Add link" icon={Link2} active={s.link} onClick={onLink} />
      {s.link ? (
        <Tool label="Remove link" icon={Unlink} onClick={() => chain().extendMarkRange("link").unsetLink().run()} />
      ) : null}
    </div>
  );
}

/**
 * Tiptap editor limited to the rich-text allowlist. Writes the document JSON
 * into a hidden input so it submits with the surrounding form.
 */
export function RichTextEditor({
  name,
  label,
  initialContent,
  errors,
  hint,
}: {
  name: string;
  label: string;
  initialContent: unknown;
  errors?: string[];
  hint?: string;
}) {
  const id = useId();
  const labelId = `${id}-label`;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = errors?.length ? `${id}-error` : undefined;
  const [json, setJson] = useState(() => JSON.stringify(initialContent ?? { type: "doc", content: [] }));
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkValue, setLinkValue] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);

  const editor = useEditor({
    extensions: editorExtensions,
    content: (initialContent as object | null) ?? undefined,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        role: "textbox",
        "aria-multiline": "true",
        "aria-labelledby": labelId,
        ...(hintId || errorId ? { "aria-describedby": [hintId, errorId].filter(Boolean).join(" ") } : {}),
        ...(errorId ? { "aria-invalid": "true" } : {}),
        class: "richtext min-h-64 px-3 py-3 focus:outline-none",
      },
    },
    onUpdate: ({ editor: e }) => setJson(JSON.stringify(e.getJSON())),
  });

  function openLink() {
    if (!editor) return;
    setLinkValue((editor.getAttributes("link").href as string | undefined) ?? "");
    setLinkError(null);
    setLinkOpen(true);
  }

  function applyLink() {
    if (!editor) return;
    const href = safeHref(linkValue.trim());
    if (!href) {
      setLinkError("Enter a full web address starting with https://");
      return;
    }
    const chain = editor.chain().focus().extendMarkRange("link");
    if (editor.state.selection.empty && !editor.isActive("link")) {
      chain.insertContent({ type: "text", text: href, marks: [{ type: "link", attrs: { href } }] }).run();
    } else {
      chain.setLink({ href }).run();
    }
    setLinkOpen(false);
  }

  return (
    <div className="space-y-1.5">
      <span id={labelId} className="text-sm font-semibold">
        {label}
      </span>
      <div
        className={cn(
          "rounded-md border border-input bg-background focus-within:ring-2 focus-within:ring-ring",
          errorId && "border-destructive",
        )}
      >
        {editor ? <Toolbar editor={editor} onLink={openLink} /> : <div className="h-[53px] border-b border-border" />}
        {linkOpen ? (
          <div className="flex flex-wrap items-start gap-2 border-b border-border p-2">
            <div className="min-w-0 flex-1">
              <Input
                type="url"
                inputMode="url"
                aria-label="Link address"
                placeholder="https://"
                value={linkValue}
                autoFocus
                className="h-11 text-base"
                aria-invalid={linkError ? true : undefined}
                onChange={(e) => setLinkValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    applyLink();
                  } else if (e.key === "Escape") {
                    setLinkOpen(false);
                  }
                }}
              />
              {linkError ? <p className="mt-1 text-sm text-destructive">{linkError}</p> : null}
            </div>
            <Button type="button" className="h-11" onClick={applyLink}>
              Apply link
            </Button>
            <Button type="button" variant="ghost" className="h-11" onClick={() => setLinkOpen(false)}>
              Cancel
            </Button>
          </div>
        ) : null}
        <EditorContent editor={editor} />
      </div>
      <input type="hidden" name={name} value={json} />
      {hint ? (
        <p id={hintId} className="text-sm text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {errorId ? (
        <p id={errorId} className="text-sm font-medium text-destructive">
          {errors?.join(" ")}
        </p>
      ) : null}
    </div>
  );
}
