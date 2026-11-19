import type { ComponentProps, ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type FieldProps = {
  name: string;
  label: string;
  hint?: ReactNode;
  errors?: string[];
} & Omit<ComponentProps<typeof Input>, "name">;

/** Labeled input with hint and error text wired up for screen readers. */
export function Field({ name, label, hint, errors, id, ...inputProps }: FieldProps) {
  const inputId = id ?? `field-${name}`;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = errors?.length ? `${inputId}-error` : undefined;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={inputId} className="text-sm font-semibold">
        {label}
      </Label>
      <Input
        id={inputId}
        name={name}
        className="h-11 text-base"
        aria-invalid={errors?.length ? true : undefined}
        aria-describedby={[hintId, errorId].filter(Boolean).join(" ") || undefined}
        {...inputProps}
      />
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

type CheckboxFieldProps = {
  name: string;
  children: ReactNode;
  errors?: string[];
  defaultChecked?: boolean;
};

/** Native checkbox (submits "on" with the form, works before JS loads). */
export function CheckboxField({ name, children, errors, defaultChecked }: CheckboxFieldProps) {
  const id = `field-${name}`;
  const errorId = errors?.length ? `${id}-error` : undefined;
  return (
    <div>
      <label htmlFor={id} className="flex min-h-11 cursor-pointer items-start gap-3 py-2 text-sm">
        <input
          id={id}
          name={name}
          type="checkbox"
          defaultChecked={defaultChecked}
          aria-invalid={errors?.length ? true : undefined}
          aria-describedby={errorId}
          className="mt-0.5 size-5 shrink-0 accent-brand"
        />
        <span>{children}</span>
      </label>
      {errorId ? (
        <p id={errorId} className="text-sm font-medium text-destructive">
          {errors?.join(" ")}
        </p>
      ) : null}
    </div>
  );
}

type TextareaFieldProps = {
  name: string;
  label: string;
  hint?: ReactNode;
  errors?: string[];
} & Omit<ComponentProps<typeof Textarea>, "name">;

export function TextareaField({ name, label, hint, errors, id, ...props }: TextareaFieldProps) {
  const inputId = id ?? `field-${name}`;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = errors?.length ? `${inputId}-error` : undefined;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={inputId} className="text-sm font-semibold">
        {label}
      </Label>
      <Textarea
        id={inputId}
        name={name}
        className="min-h-28 text-base"
        aria-invalid={errors?.length ? true : undefined}
        aria-describedby={[hintId, errorId].filter(Boolean).join(" ") || undefined}
        {...props}
      />
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
