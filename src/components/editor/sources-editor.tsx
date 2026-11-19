"use client";

import { Plus, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ARTICLE_LIMITS } from "@/lib/validation/article";

type Row = { key: number; url: string; label: string };

/** Up to 10 source links. Submits repeated sourceUrl / sourceLabel fields. */
export function SourcesEditor({
  initial,
  errors,
}: {
  initial: { url: string; label: string | null }[];
  errors?: string[];
}) {
  const [rows, setRows] = useState<Row[]>(() =>
    initial.map((s, i) => ({ key: i, url: s.url, label: s.label ?? "" })),
  );
  const [nextKey, setNextKey] = useState(initial.length);

  function add() {
    setRows((r) => [...r, { key: nextKey, url: "", label: "" }]);
    setNextKey((k) => k + 1);
  }

  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-semibold">Sources</legend>
      <p className="text-sm text-muted-foreground">
        Link to where facts come from: documents, official pages, other reporting. Serious claims about
        people need sources.
      </p>
      {rows.map((row, i) => (
        <div key={row.key} className="rounded-md border border-border p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Source {i + 1}</span>
            <Button
              type="button"
              variant="ghost"
              className="h-11"
              aria-label={`Remove source ${i + 1}`}
              onClick={() => setRows((r) => r.filter((x) => x.key !== row.key))}
            >
              <X className="size-4" aria-hidden />
            </Button>
          </div>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`source-url-${row.key}`}>Web address</Label>
              <Input
                id={`source-url-${row.key}`}
                name="sourceUrl"
                type="url"
                inputMode="url"
                placeholder="https://"
                className="h-11 text-base"
                defaultValue={row.url}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`source-label-${row.key}`}>Label (optional)</Label>
              <Input
                id={`source-label-${row.key}`}
                name="sourceLabel"
                maxLength={ARTICLE_LIMITS.sourceLabel}
                placeholder="e.g. City council minutes"
                className="h-11 text-base"
                defaultValue={row.label}
              />
            </div>
          </div>
        </div>
      ))}
      {rows.length < ARTICLE_LIMITS.sources ? (
        <Button type="button" variant="outline" className="h-11" onClick={add}>
          <Plus className="size-4" aria-hidden /> Add a source
        </Button>
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
