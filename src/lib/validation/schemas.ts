import { z } from "zod";
import { safeExternalUrl } from "./url";

/**
 * Shared Zod building blocks. Entity schemas (T3.1) are composed from these
 * so persistence, import, and form validation use one definition (D-006).
 */

/** Trimmed text that must not be empty. */
export function requiredText(label: string, max: number) {
  return z
    .string()
    .trim()
    .min(1, `${label} is required.`)
    .max(max, `${label} must be ${max} characters or fewer.`);
}

/** Trimmed text that may be empty. */
export function optionalText(label: string, max: number) {
  return z.string().trim().max(max, `${label} must be ${max} characters or fewer.`);
}

/** An absolute http(s) URL, normalized by `safeExternalUrl`. */
export const externalUrlSchema = z
  .string()
  .trim()
  .transform((value, ctx) => {
    const safe = safeExternalUrl(value);
    if (safe === null) {
      ctx.addIssue({
        code: "custom",
        message: "Enter a full web address starting with http:// or https://.",
      });
      return z.NEVER;
    }
    return safe;
  });
