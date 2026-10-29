import type { z } from "zod";
import { err, type Result } from "./result";

/** Field path → first error message for that field. "" holds form-level errors. */
export type FieldErrors = Record<string, string>;

export function toFieldErrors(error: z.ZodError): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of error.issues) {
    const path = issue.path.map(String).join(".");
    if (!(path in errors)) errors[path] = issue.message;
  }
  return errors;
}

/**
 * Validates input with a schema and returns a Result. On failure the
 * AppError points at the first invalid field; use `toFieldErrors` on the
 * returned issues to show every field's message.
 */
export function validate<S extends z.ZodType>(
  schema: S,
  input: unknown,
): Result<z.output<S>> & { fieldErrors?: FieldErrors } {
  const parsed = schema.safeParse(input);
  if (parsed.success) return { ok: true, value: parsed.data };

  const fieldErrors = toFieldErrors(parsed.error);
  const [firstField, firstMessage] = Object.entries(fieldErrors)[0] ?? ["", "Invalid input."];
  const result = err<z.output<S>>(
    "validation_failed",
    firstMessage,
    firstField === "" ? undefined : firstField,
  );
  return { ...result, fieldErrors };
}
