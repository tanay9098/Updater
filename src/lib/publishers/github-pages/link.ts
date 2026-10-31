import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { githubUsernameSchema } from "@/lib/providers/github/repositories";
import type { ReadyConfig, SiteLink } from "./publisher";
import { GITHUB_WEB_ORIGIN, fail, githubRequest, unexpected, type GithubDeps, type Outcome } from "./github-api";

/**
 * Linking a GitHub account to the signed-in Updater account (T10.9, D-037).
 * The developer authorizes Updater's GitHub App once; Updater uses the
 * one-time user token only to learn which GitHub account that is, then
 * revokes it. Nothing GitHub issues is stored: publishing uses short-lived
 * installation tokens minted per request.
 *
 * `state` (checked against an HTTP-only cookie) and PKCE protect the
 * callback, as in the Google sign-in (architecture.md §10).
 */

export type AuthorizationRequest = { state: string; codeVerifier: string; url: string };

function base64url(bytes: Buffer): string {
  return bytes.toString("base64url");
}

export function createAuthorizationRequest(config: ReadyConfig, redirectUri: string): AuthorizationRequest {
  const state = base64url(randomBytes(32));
  const codeVerifier = base64url(randomBytes(32));
  const challenge = base64url(createHash("sha256").update(codeVerifier).digest());
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri,
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    allow_signup: "false",
  });
  return { state, codeVerifier, url: `${GITHUB_WEB_ORIGIN}/login/oauth/authorize?${params.toString()}` };
}

const tokenResponseSchema = z.union([
  z.object({ access_token: z.string().min(1) }),
  z.object({ error: z.string(), error_description: z.string().optional() }),
]);
const userSchema = z.object({ id: z.number().int().positive(), login: githubUsernameSchema });

/** Exchanges the callback code, reads the GitHub account it belongs to, and revokes the token. */
export async function verifyGithubAccount(
  deps: GithubDeps,
  config: ReadyConfig,
  input: { code: string; codeVerifier: string; redirectUri: string },
): Promise<Outcome<SiteLink>> {
  const exchanged = await githubRequest(deps, {
    method: "POST",
    origin: GITHUB_WEB_ORIGIN,
    path: "/login/oauth/access_token",
    body: {
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code: input.code,
      redirect_uri: input.redirectUri,
      code_verifier: input.codeVerifier,
    },
  });
  if (!exchanged.ok) return exchanged;
  if (exchanged.value.status !== 200) return unexpected(exchanged.value.status, "confirming the GitHub authorization");
  const token = tokenResponseSchema.safeParse(exchanged.value.data);
  if (!token.success) return unexpected(exchanged.value.status, "confirming the GitHub authorization");
  if ("error" in token.data) {
    return fail("authorization_failed", "GitHub didn't confirm the authorization. It may have expired. Connect GitHub again.");
  }
  const accessToken = token.data.access_token;

  const user = await githubRequest(deps, { path: "/user", auth: `Bearer ${accessToken}` });
  await revokeUserToken(deps, config, accessToken);
  if (!user.ok) return user;
  if (user.value.status !== 200) return unexpected(user.value.status, "reading your GitHub account");
  const parsed = userSchema.safeParse(user.value.data);
  if (!parsed.success) return unexpected(user.value.status, "reading your GitHub account");
  return { ok: true, value: { githubUserId: parsed.data.id, login: parsed.data.login } };
}

/** Best effort: the token was only needed to identify the account. GitHub also expires it on its own. */
async function revokeUserToken(deps: GithubDeps, config: ReadyConfig, accessToken: string): Promise<void> {
  const basic = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64");
  await githubRequest(deps, {
    method: "DELETE",
    path: `/applications/${encodeURIComponent(config.clientId)}/token`,
    auth: `Basic ${basic}`,
    body: { access_token: accessToken },
  });
}
