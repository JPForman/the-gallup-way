"use client";

import { ImagePlus, X } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ARTICLE_IMAGE_BUCKET } from "@/lib/db/articles";
import { createClient } from "@/lib/supabase/client";
import { ARTICLE_LIMITS } from "@/lib/validation/article";

export type EditorImage = {
  storage_path: string;
  url: string;
  alt_text: string;
  caption: string | null;
  credit: string | null;
};

type Row = EditorImage & { key: string };

function newFileName(): string {
  return `${crypto.randomUUID().slice(0, 8)}-${Date.now().toString(36)}.webp`;
}

/**
 * Up to 3 photos. Files are compressed in the browser and uploaded to
 * <user id>/<article id>/ right away; the story's photo list (and caption,
 * credit, description) changes when the form is saved.
 */
export function ImagesEditor({
  userId,
  articleId,
  initial,
  errors,
}: {
  userId: string;
  articleId: string | null;
  initial: EditorImage[];
  errors?: string[];
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<Row[]>(() => initial.map((img) => ({ ...img, key: img.storage_path })));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onChoose(file: File | undefined) {
    if (!file || !articleId) return;
    setError(null);
    setBusy(true);
    try {
      const { compressArticleImage } = await import("@/lib/images/compress");
      const compressed = await compressArticleImage(file);
      const path = `${userId}/${articleId}/${newFileName()}`;
      const { error: upErr } = await createClient()
        .storage.from(ARTICLE_IMAGE_BUCKET)
        .upload(path, compressed, { contentType: "image/webp", upsert: false });
      if (upErr) throw new Error("Upload failed. Please try again.");
      setRows((r) => [
        ...r,
        { key: path, storage_path: path, url: URL.createObjectURL(compressed), alt_text: "", caption: null, credit: null },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong with that photo.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-semibold">Photos</legend>
      {!articleId ? (
        <p className="text-sm text-muted-foreground">Save the draft first, then you can add up to 3 photos.</p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Up to 3 photos you took or have permission to use. Resized on your device before upload.
        </p>
      )}

      {rows.map((row, i) => (
        <div key={row.key} className="rounded-md border border-border p-3">
          <input type="hidden" name="imagePath" value={row.storage_path} />
          <div className="flex items-start gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- local blob/CDN preview */}
            <img src={row.url} alt="" className="h-20 w-28 shrink-0 rounded object-cover" />
            <div className="flex flex-1 items-center justify-between">
              <span className="text-sm font-medium">Photo {i + 1}</span>
              <Button
                type="button"
                variant="ghost"
                className="h-11"
                aria-label={`Remove photo ${i + 1}`}
                onClick={() => setRows((r) => r.filter((x) => x.key !== row.key))}
              >
                <X className="size-4" aria-hidden />
              </Button>
            </div>
          </div>
          <div className="mt-3 grid gap-3">
            <div className="space-y-1.5">
              <Label htmlFor={`img-alt-${i}`}>Description (for screen readers)</Label>
              <Input
                id={`img-alt-${i}`}
                name="imageAlt"
                required
                maxLength={ARTICLE_LIMITS.altText}
                placeholder="What the photo shows"
                className="h-11 text-base"
                defaultValue={row.alt_text}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor={`img-caption-${i}`}>Caption (optional)</Label>
                <Input
                  id={`img-caption-${i}`}
                  name="imageCaption"
                  maxLength={ARTICLE_LIMITS.caption}
                  className="h-11 text-base"
                  defaultValue={row.caption ?? ""}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`img-credit-${i}`}>Photo credit (optional)</Label>
                <Input
                  id={`img-credit-${i}`}
                  name="imageCredit"
                  maxLength={ARTICLE_LIMITS.credit}
                  placeholder="Who took it"
                  className="h-11 text-base"
                  defaultValue={row.credit ?? ""}
                />
              </div>
            </div>
          </div>
        </div>
      ))}

      {articleId && rows.length < ARTICLE_LIMITS.images ? (
        <>
          <Button
            type="button"
            variant="outline"
            className="h-11"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            <ImagePlus className="size-4" aria-hidden /> {busy ? "Uploading…" : "Add a photo"}
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            aria-label="Choose a photo"
            tabIndex={-1}
            onChange={(e) => void onChoose(e.target.files?.[0])}
          />
        </>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}
      {errors?.length ? (
        <ul className="space-y-1 text-sm font-medium text-destructive">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      ) : null}
    </fieldset>
  );
}
