import type { NextRequest } from "next/server";
import { auth, authConfig } from "@/auth";
import { readGithubAppConfig } from "./config";
import type { HandlerDeps } from "./handlers";
import { LINK_COOKIE, openLink } from "./link-cookie";
import type { SiteLink } from "./publisher";

/**
 * Shared plumbing for the publishing route handlers (T10.9). Server-only:
 * imported by `src/app/api/github/app/*` and `src/app/api/portfolio/*`.
 */

export const NO_STORE = { "Cache-Control": "private, no-store" } as const;

export const githubAppConfig = readGithubAppConfig({
  GITHUB_APP_ID: process.env.GITHUB_APP_ID,
  GITHUB_APP_SLUG: process.env.GITHUB_APP_SLUG,
  GITHUB_APP_CLIENT_ID: process.env.GITHUB_APP_CLIENT_ID,
  GITHUB_APP_CLIENT_SECRET: process.env.GITHUB_APP_CLIENT_SECRET,
  GITHUB_APP_PRIVATE_KEY: process.env.GITHUB_APP_PRIVATE_KEY,
});

if (githubAppConfig.state === "invalid" && process.env.NODE_ENV !== "production") {
  console.warn(`[updater] Publishing is off: ${githubAppConfig.problem}`);
}

export function handlerDeps(): HandlerDeps {
  return { fetch, now: () => new Date(), config: githubAppConfig };
}

export type SignedIn = { accountId: string; secret: string };

/**
 * The signed-in account, or the response to send instead. The proxy already
 * requires a session for /api/*; checking again keeps each route safe on its own.
 */
export async function requireAccount(): Promise<SignedIn | Response> {
  if (authConfig.state !== "ready") return Response.json({ error: "Sign-in isn't configured." }, { status: 503, headers: NO_STORE });
  const session = await auth();
  if (!session?.accountId) return Response.json({ error: "Sign in required." }, { status: 401, headers: NO_STORE });
  return { accountId: session.accountId, secret: authConfig.secret };
}

export async function linkFor(request: NextRequest, account: SignedIn): Promise<SiteLink | null> {
  return openLink(account.secret, account.accountId, request.cookies.get(LINK_COOKIE)?.value);
}

/**
 * Requests that change something must come from Updater's own pages. The
 * session cookie is SameSite=Lax, which already stops cross-site POSTs;
 * this check doesn't rely on that alone.
 */
export function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  return origin !== null && origin === request.nextUrl.origin;
}

export function isSecure(request: NextRequest): boolean {
  return request.nextUrl.protocol === "https:";
}
