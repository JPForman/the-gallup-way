"use client";

import { startTransition, useActionState, type FormEvent } from "react";
import { Field, TextareaField } from "@/components/forms/field";
import { FormMessage } from "@/components/forms/form-message";
import { ImagesEditor, type EditorImage } from "@/components/editor/images-editor";
import { RichTextEditor } from "@/components/editor/rich-text-editor";
import { SourcesEditor } from "@/components/editor/sources-editor";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { FormState } from "@/lib/forms/state";
import { CATEGORIES } from "@/lib/site";
import { ARTICLE_LIMITS, CONTENT_TYPES } from "@/lib/validation/article";
import { saveArticle } from "./actions";

export type ArticleFormInitial = {
  articleId: string | null;
  title: string;
  dek: string;
  category: string;
  contentType: string;
  body: unknown;
  sources: { url: string; label: string | null }[];
  images: EditorImage[];
};

const selectClass =
  "h-11 w-full rounded-md border border-input bg-background px-3 text-base focus-visible:outline-2 focus-visible:outline-ring";

export function ArticleForm({
  userId,
  initial,
  initialMessage,
  isLive,
}: {
  userId: string;
  initial: ArticleFormInitial;
  initialMessage?: FormState;
  /** Published stories: saving changes the live page. */
  isLive?: boolean;
}) {
  const [state, formAction, pending] = useActionState(saveArticle, initialMessage ?? {});
  const errors = state.fieldErrors ?? {};

  // Submit via a transition instead of <form action>, so React doesn't reset
  // the (long) form after each save.
  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => formAction(fd));
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      <FormMessage message={state.message} status={state.status} />
      <input type="hidden" name="articleId" value={initial.articleId ?? ""} />

      <Field
        name="title"
        label="Headline"
        defaultValue={initial.title}
        maxLength={ARTICLE_LIMITS.title}
        hint="Plain and specific: what happened, where."
        errors={errors.title}
      />
      <TextareaField
        name="dek"
        label="Summary (optional)"
        defaultValue={initial.dek}
        maxLength={ARTICLE_LIMITS.dek}
        className="min-h-20 text-base"
        hint="One or two sentences shown under the headline."
        errors={errors.dek}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="field-category" className="text-sm font-semibold">
            Category
          </Label>
          <select
            id="field-category"
            name="category"
            defaultValue={initial.category}
            className={selectClass}
            aria-invalid={errors.category?.length ? true : undefined}
          >
            <option value="">Choose a category</option>
            {CATEGORIES.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
          {errors.category?.length ? (
            <p className="text-sm font-medium text-destructive">{errors.category.join(" ")}</p>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="field-contentType" className="text-sm font-semibold">
            Story type
          </Label>
          <select
            id="field-contentType"
            name="contentType"
            defaultValue={initial.contentType}
            className={selectClass}
            aria-describedby="field-contentType-hint"
          >
            {CONTENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <p id="field-contentType-hint" className="text-sm text-muted-foreground">
            Opinion pieces are labeled as opinion.
          </p>
        </div>
      </div>

      <RichTextEditor name="body" label="Story" initialContent={initial.body} errors={errors.body} />

      <ImagesEditor userId={userId} articleId={initial.articleId} initial={initial.images} errors={errors.images} />

      <SourcesEditor initial={initial.sources} errors={errors.sources} />

      <div className="sticky bottom-16 z-10 -mx-4 border-t border-border bg-background/95 px-4 py-3 backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:px-0">
        <Button
          type="submit"
          disabled={pending}
          aria-disabled={pending}
          className="h-11 w-full bg-brand text-base text-brand-foreground hover:bg-brand/90 sm:w-auto sm:px-8"
        >
          {pending ? "Saving…" : isLive ? "Save changes" : "Save draft"}
        </Button>
        {isLive ? (
          <p className="mt-2 text-sm text-muted-foreground">This story is published. Saving updates it right away.</p>
        ) : null}
      </div>
    </form>
  );
}
