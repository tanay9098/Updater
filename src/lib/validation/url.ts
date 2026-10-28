/**
 * External URLs are untrusted (rules.md §7.3.6). Only absolute http: and
 * https: URLs are accepted. Anything else (javascript:, data:, relative
 * paths, malformed input) is rejected.
 */
export function safeExternalUrl(input: string | null | undefined): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (trimmed === "") return null;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.hostname === "") return null;
  // Credentials in a URL are never shown or followed.
  if (url.username !== "" || url.password !== "") return null;

  return url.href;
}
