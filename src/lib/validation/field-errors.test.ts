import { describe, expect, it } from "vitest";
import { z } from "zod";
import { toFieldErrors, validate } from "./field-errors";
import { err, ok } from "./result";
import { externalUrlSchema, optionalText, requiredText } from "./schemas";

const linkSchema = z.object({
  label: requiredText("Label", 40),
  url: externalUrlSchema,
  note: optionalText("Note", 10),
});

describe("Result helpers", () => {
  it("builds success and failure values", () => {
    expect(ok(3)).toEqual({ ok: true, value: 3 });
    expect(err("not_found", "Missing.")).toEqual({
      ok: false,
      error: { code: "not_found", message: "Missing." },
    });
    expect(err("validation_failed", "Bad.", "url")).toEqual({
      ok: false,
      error: { code: "validation_failed", message: "Bad.", field: "url" },
    });
  });
});

describe("validate", () => {
  it("returns trimmed, normalized values on success", () => {
    const result = validate(linkSchema, { label: "  Site ", url: "https://example.com", note: "" });
    expect(result).toEqual({
      ok: true,
      value: { label: "Site", url: "https://example.com/", note: "" },
    });
  });

  it("maps every invalid field to its first message", () => {
    const result = validate(linkSchema, { label: "   ", url: "javascript:alert(1)", note: "x".repeat(11) });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({
      code: "validation_failed",
      message: "Label is required.",
      field: "label",
    });
    expect(result.fieldErrors).toEqual({
      label: "Label is required.",
      url: "Enter a full web address starting with http:// or https://.",
      note: "Note must be 10 characters or fewer.",
    });
  });

  it("joins nested paths and keeps form-level errors under the empty key", () => {
    const nested = z.object({ links: z.array(z.object({ url: externalUrlSchema })) });
    const parsed = nested.safeParse({ links: [{ url: "https://example.com" }, { url: "nope" }] });
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(Object.keys(toFieldErrors(parsed.error))).toEqual(["links.1.url"]);

    const formLevel = z.string().safeParse(42);
    if (!formLevel.success) expect(Object.keys(toFieldErrors(formLevel.error))).toEqual([""]);
  });
});
