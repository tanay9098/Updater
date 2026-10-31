import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { verifyGithubAccount } from "@/lib/publishers/github-pages/link";
import {
  LINK_COOKIE,
  LINK_MAX_AGE,
  OAUTH_COOKIE,
  OAUTH_COOKIE_PATH,
  cookieOptions,
  openPendingAuthorization,
  sealLink,
} from "@/lib/publishers/github-pages/link-cookie";
import type { CallbackOutcome } from "@/lib/publishers/github-pages/contract";
import { NO_STORE, githubAppConfig, handlerDeps, isSecure, requireAccount } from "@/lib/publishers/github-pages/server";

function sameSecret(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * GitHub's redirect after the developer authorized Updater's GitHub App
 * (T10.9). Checks `state` against the pending authorization of the same
 * signed-in account, exchanges the code with the PKCE verifier, learns
 * which GitHub account authorized, and remembers only that, in an
 * encrypted HTTP-only cookie. The pending authorization is always cleared.
 */
export async function GET(request: NextRequest) {
  const account = await requireAccount();
  if (account instanceof Response) return account;

  const finish = (outcome: CallbackOutcome) => {
    const response = NextResponse.redirect(new URL(`/portfolio?github=${outcome}`, request.nextUrl.origin), { headers: NO_STORE });
    response.cookies.set(OAUTH_COOKIE, "", cookieOptions(isSecure(request), OAUTH_COOKIE_PATH, 0));
    return response;
  };

  if (githubAppConfig.state !== "ready") return finish("unavailable");
  const params = request.nextUrl.searchParams;
  if (params.get("error")) return finish("denied");

  const pending = await openPendingAuthorization(account.secret, request.cookies.get(OAUTH_COOKIE)?.value);
  const state = params.get("state") ?? "";
  const code = params.get("code") ?? "";
  if (!pending || pending.accountId !== account.accountId || !code || code.length > 200 || !sameSecret(state, pending.state)) {
    return finish("invalid");
  }

  const verified = await verifyGithubAccount(handlerDeps(), githubAppConfig, {
    code,
    codeVerifier: pending.codeVerifier,
    redirectUri: `${request.nextUrl.origin}/api/github/app/callback`,
  });
  if (!verified.ok) return finish("failed");

  const response = finish("linked");
  response.cookies.set(
    LINK_COOKIE,
    await sealLink(account.secret, account.accountId, verified.value),
    cookieOptions(isSecure(request), "/", LINK_MAX_AGE),
  );
  return response;
}
