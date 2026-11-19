"use client";

import { useRef, useState } from "react";
import { Avatar } from "@/components/avatar";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

const BUCKET = "avatars";

function newFileName(): string {
  return `${crypto.randomUUID().slice(0, 8)}-${Date.now().toString(36)}.webp`;
}

/**
 * Compresses the chosen photo in the browser, uploads it to the user's own
 * folder, and puts the new path in a hidden input for the profile form.
 * The profile isn't changed until the form is saved.
 */
export function AvatarPicker({
  userId,
  name,
  currentUrl,
}: {
  userId: string;
  name: string;
  currentUrl: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(currentUrl);
  const [path, setPath] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onChoose(file: File | undefined) {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      // Loaded on demand: the compressor is large and only needed here.
      const { compressAvatar } = await import("@/lib/images/compress");
      const compressed = await compressAvatar(file);
      const target = `${userId}/${newFileName()}`;
      const { error: upErr } = await createClient()
        .storage.from(BUCKET)
        .upload(target, compressed, { contentType: "image/webp", upsert: false });
      if (upErr) throw new Error("Upload failed. Please try again.");
      setPreview(URL.createObjectURL(compressed));
      setPath(target);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong with that photo.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-semibold">Photo</legend>
      <div className="flex items-center gap-4">
        <Avatar name={name} src={preview} size={72} />
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-11"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? "Uploading…" : preview ? "Change photo" : "Add photo"}
          </Button>
          {preview ? (
            <Button
              type="button"
              variant="ghost"
              className="h-11"
              disabled={busy}
              onClick={() => {
                setPreview(null);
                setPath("remove");
              }}
            >
              Remove
            </Button>
          ) : null}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        aria-label="Choose a profile photo"
        tabIndex={-1}
        onChange={(e) => void onChoose(e.target.files?.[0])}
      />
      <input type="hidden" name="avatarPath" value={path} />
      <p className="text-sm text-muted-foreground">
        Optional. Resized on your device before upload. Save the form to apply.
      </p>
      {error ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
