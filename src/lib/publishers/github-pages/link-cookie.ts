import { decode, encode } from "next-auth/jwt";
import { z } from "zod";
import type { SiteLink } from "./publisher";

/**
 * Server-side memory of the linked GitHub account (T10.9, D-037), without a
 * database: an encrypted, HTTP-only cookie, sealed with the Auth.js secret
 * through Auth.js's own JWT encryption (rules.md §7.3.9), under salts that
 * differ from the session's. It holds no GitHub token, only which GitHub
 * account the signed-in Updater account verified, and it is bound to that
 * Updater account: another account in the same browser can't use it.
 *
 * The link is per browser, like the workspace (D-030). On another device
 * the developer connects GitHub again.
 */

export const LINK_COOKIE = "updater.github-link";
export const OAUTH_COOKIE = "updater.github-oauth";
const LINK_SALT = "updater.github-link.v1";
const OAUTH_SALT = "updater.github-oauth.v1";
export const LINK_MAX_AGE = 30 * 24 * 60 * 60;
export const OAUTH_MAX_AGE = 10 * 60;
/** The pending authorization is only needed by the callback. */
export const OAUTH_COOKIE_PATH = "/api/github/app";

export type CookieOptions = { httpOnly: true; sameSite: "lax"; secure: boolean; path: string; maxAge: number };

export function cookieOptions(secure: boolean, path: string, maxAge: number): CookieOptions {
  return { httpOnly: true, sameSite: "lax", secure, path, maxAge };
}

const linkPayloadSchema = z.object({
  accountId: z.string().min(1).max(200),
  githubUserId: z.number().int().positive(),
  login: z.string().min(1).max(39),
});

const oauthPayloadSchema = z.object({
  accountId: z.string().min(1).max(200),
  state: z.string().min(16).max(100),
  codeVerifier: z.string().min(16).max(100),
});

export type PendingAuthorization = z.infer<typeof oauthPayloadSchema>;

export async function sealLink(secret: string, accountId: string, link: SiteLink): Promise<string> {
  return encode({ token: { accountId, ...link }, secret, salt: LINK_SALT, maxAge: LINK_MAX_AGE });
}

/** The link, only if the cookie is intact, unexpired, and belongs to this Updater account. */
export async function openLink(secret: string, accountId: string, value: string | undefined): Promise<SiteLink | null> {
  if (!value) return null;
  try {
    const parsed = linkPayloadSchema.safeParse(await decode({ token: value, secret, salt: LINK_SALT }));
    if (!parsed.success || parsed.data.accountId !== accountId) return null;
    return { githubUserId: parsed.data.githubUserId, login: parsed.data.login };
  } catch {
    return null;
  }
}

export async function sealPendingAuthorization(secret: string, pending: PendingAuthorization): Promise<string> {
  return encode({ token: pending, secret, salt: OAUTH_SALT, maxAge: OAUTH_MAX_AGE });
}

export async function openPendingAuthorization(secret: string, value: string | undefined): Promise<PendingAuthorization | null> {
  if (!value) return null;
  try {
    const parsed = oauthPayloadSchema.safeParse(await decode({ token: value, secret, salt: OAUTH_SALT }));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
