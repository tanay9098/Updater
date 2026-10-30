import type { AuthMode } from "./config";

/**
 * Request-level access rules applied by `src/proxy.ts` (architecture.md §10).
 * Pure, so every combination is unit tested.
 *
 * Workspace data never reaches the server, so this gate decides who can open
 * the app at all; the workspace itself is chosen in the browser from the
 * account the server reports (`/api/account`).
 */

export const SIGN_IN_PATH = "/sign-in";

/** Reachable without a session: the sign-in page, Auth.js endpoints, and the account status endpoint. */
const PUBLIC_PREFIXES = [SIGN_IN_PATH, "/api/auth/", "/api/account"];

export type AccessDecision =
  | { action: "allow" }
  | { action: "redirect"; to: string }
  /** For API requests: answer 401 instead of redirecting. */
  | { action: "deny" };

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((prefix) =>
    prefix.endsWith("/") ? pathname.startsWith(prefix) : pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function decideAccess({
  pathname,
  search = "",
  mode,
  signedIn,
}: {
  pathname: string;
  search?: string;
  mode: AuthMode;
  signedIn: boolean;
}): AccessDecision {
  if (mode === "off" || isPublicPath(pathname)) return { action: "allow" };
  if (mode === "ready" && signedIn) return { action: "allow" };
  if (pathname === "/api" || pathname.startsWith("/api/")) return { action: "deny" };
  if (mode === "incomplete") return { action: "redirect", to: SIGN_IN_PATH };
  const params = new URLSearchParams({ callbackUrl: `${pathname}${search}` });
  return { action: "redirect", to: `${SIGN_IN_PATH}?${params.toString()}` };
}

/**
 * Where to go after signing in. Only same-site paths are accepted, so a
 * crafted `callbackUrl` can't send the user to another site.
 */
export function safeCallbackPath(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/";
  if (value === SIGN_IN_PATH || value.startsWith(`${SIGN_IN_PATH}?`) || value.startsWith(`${SIGN_IN_PATH}/`)) return "/";
  return value;
}
