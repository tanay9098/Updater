import { NextResponse, type NextRequest } from "next/server";
import { createAuthorizationRequest } from "@/lib/publishers/github-pages/link";
import {
  OAUTH_COOKIE,
  OAUTH_COOKIE_PATH,
  OAUTH_MAX_AGE,
  cookieOptions,
  sealPendingAuthorization,
} from "@/lib/publishers/github-pages/link-cookie";
import { NO_STORE, githubAppConfig, isSecure, requireAccount } from "@/lib/publishers/github-pages/server";

/**
 * "Connect GitHub" (T10.9, architecture.md §13.1). Sends the developer to
 * GitHub to authorize Updater's GitHub App, with `state` and a PKCE
 * challenge whose secrets wait in an encrypted HTTP-only cookie for the
 * callback.
 */
export async function GET(request: NextRequest) {
  const account = await requireAccount();
  if (account instanceof Response) return account;
  if (githubAppConfig.state !== "ready") {
    return NextResponse.redirect(new URL("/portfolio?github=unavailable", request.nextUrl.origin), { headers: NO_STORE });
  }

  const redirectUri = `${request.nextUrl.origin}/api/github/app/callback`;
  const authorization = createAuthorizationRequest(githubAppConfig, redirectUri);
  const response = NextResponse.redirect(authorization.url, { headers: NO_STORE });
  response.cookies.set(
    OAUTH_COOKIE,
    await sealPendingAuthorization(account.secret, {
      accountId: account.accountId,
      state: authorization.state,
      codeVerifier: authorization.codeVerifier,
    }),
    cookieOptions(isSecure(request), OAUTH_COOKIE_PATH, OAUTH_MAX_AGE),
  );
  return response;
}
