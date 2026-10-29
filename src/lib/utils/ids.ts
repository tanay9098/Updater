/**
 * Opaque identifiers with a readable prefix (architecture.md §5), for
 * example `rev_3f2c…`. `crypto.randomUUID` only exists in secure contexts,
 * so plain-HTTP deployments fall back to `crypto.getRandomValues`.
 */
export type IdPrefix = "src" | "item" | "ev" | "claim" | "proj" | "rev" | "res" | "skill" | "link" | "act" | "prof";

export function createId(prefix: IdPrefix): string {
  return `${prefix}_${randomUuid()}`;
}

function randomUuid(): string {
  const cryptoApi = globalThis.crypto;
  if (typeof cryptoApi?.randomUUID === "function") return cryptoApi.randomUUID();
  const bytes = new Uint8Array(16);
  cryptoApi.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
