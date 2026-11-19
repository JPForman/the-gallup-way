import { z } from "zod";

export type FormState = {
  /** Message shown above the form (error or success). */
  message?: string;
  status?: "error" | "success";
  fieldErrors?: Record<string, string[] | undefined>;
  /** Echo of non-secret fields so the form keeps what the user typed. */
  values?: Record<string, string>;
};

export function formValues(formData: FormData, keys: string[]): Record<string, string> {
  return Object.fromEntries(keys.map((k) => [k, String(formData.get(k) ?? "")]));
}

export function fieldErrorsOf(error: z.ZodError): FormState["fieldErrors"] {
  return z.flattenError(error).fieldErrors as FormState["fieldErrors"];
}
