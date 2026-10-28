import { describe, expect, it } from "vitest";
import { safeExternalUrl } from "./url";

describe("safeExternalUrl", () => {
  it("accepts absolute http and https URLs and normalizes them", () => {
    expect(safeExternalUrl("https://example.com")).toBe("https://example.com/");
    expect(safeExternalUrl("  http://example.com/a?b=1#c  ")).toBe("http://example.com/a?b=1#c");
    expect(safeExternalUrl("HTTPS://Example.COM/Path")).toBe("https://example.com/Path");
  });

  it.each([
    "javascript:alert(1)",
    "JaVaScRiPt:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox",
    "file:///etc/passwd",
    "ftp://example.com",
    "mailto:someone@example.com",
    "/relative/path",
    "example.com",
    "//example.com",
    "https://",
    "https://user:secret@example.com",
    "",
    "   ",
  ])("rejects %j", (input) => {
    expect(safeExternalUrl(input)).toBeNull();
  });

  it("rejects non-string input", () => {
    expect(safeExternalUrl(null)).toBeNull();
    expect(safeExternalUrl(undefined)).toBeNull();
  });
});
