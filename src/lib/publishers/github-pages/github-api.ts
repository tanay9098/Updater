import { createPrivateKey } from "node:crypto";
import { SignJWT } from "jose";
import { GITHUB_API_ORIGIN, GITHUB_API_VERSION, REQUEST_TIMEOUT_MS, rateLimitResetAt } from "@/lib/providers/github/repositories";

/**
 * Server-only GitHub calls for publishing (T10.9, architecture.md §13).
 * Every request goes to a fixed origin (`api.github.com`, or `github.com`
 * for the OAuth code exchange) with a path built from validated values,
 * refuses redirects, and times out. Tokens are never logged or returned to
 * the browser (rules.md §7.3).
 *
 * Pure apart from the injected `fetch` and clock, so every outcome is unit
 * tested.
 */

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;
export type GithubDeps = { fetch: FetchLike; now: () => Date };

export const GITHUB_WEB_ORIGIN = "https://github.com";

export type PagesErrorCode =
  | "not_configured"
  | "not_linked"
  | "not_installed"
  | "repository_missing"
  | "repository_empty"
  | "branch_in_use"
  | "pages_source_conflict"
  | "branch_changed"
  | "authorization_failed"
  | "invalid_request"
  | "rate_limited"
  | "provider_error"
  | "unreachable";

export type PagesError = {
  code: PagesErrorCode;
  message: string;
  /** When GitHub said requests may resume (`rate_limited`). */
  resetAt?: string;
  /** What GitHub Pages serves today (`pages_source_conflict`), e.g. "main branch, / folder". */
  currentSource?: string;
};

export type Outcome<T> = { ok: true; value: T } | { ok: false; error: PagesError };

export function fail<T = never>(code: PagesErrorCode, message: string, extra: Partial<PagesError> = {}): Outcome<T> {
  return { ok: false, error: { code, message, ...extra } };
}

export type GithubResponse = { status: number; data: unknown };

/**
 * Calls GitHub. Returns the status and parsed body for the caller to
 * interpret, or a failure for problems that mean the same thing everywhere:
 * the network, a timeout, or a rate limit.
 */
export async function githubRequest(
  deps: GithubDeps,
  request: { method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE"; path: string; auth?: string; body?: unknown; origin?: string },
): Promise<Outcome<GithubResponse>> {
  const origin = request.origin ?? GITHUB_API_ORIGIN;
  const headers: Record<string, string> = {
    Accept: origin === GITHUB_API_ORIGIN ? "application/vnd.github+json" : "application/json",
    "User-Agent": "Updater",
  };
  if (origin === GITHUB_API_ORIGIN) headers["X-GitHub-Api-Version"] = GITHUB_API_VERSION;
  if (request.auth) headers.Authorization = request.auth;
  if (request.body !== undefined) headers["Content-Type"] = "application/json";

  let response: Response;
  try {
    response = await deps.fetch(`${origin}${request.path}`, {
      method: request.method ?? "GET",
      headers,
      ...(request.body !== undefined ? { body: JSON.stringify(request.body) } : {}),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    return fail(
      "unreachable",
      timedOut ? "GitHub didn't answer in time. Try again in a moment." : "Updater's server couldn't reach GitHub. Try again in a moment.",
    );
  }

  const resetAt = rateLimitResetAt(response, deps.now());
  if (resetAt) return fail("rate_limited", "GitHub's request limit was reached.", { resetAt });

  let data: unknown = null;
  if (response.status !== 204) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  }
  return { ok: true, value: { status: response.status, data } };
}

export function unexpected<T = never>(status: number, what: string): Outcome<T> {
  return fail("provider_error", `GitHub answered with an error while ${what} (HTTP ${status}). Try again later.`);
}

/**
 * A short-lived JSON Web Token that identifies Updater's GitHub App
 * (GitHub: "Generating a JSON Web Token for a GitHub App"). Signed with
 * `jose` (rules.md §7.3.9); `createPrivateKey` reads both PKCS#1 keys, the
 * format GitHub issues, and PKCS#8. Backdated 60 s for clock drift; valid
 * for 9 minutes (GitHub's maximum is 10).
 */
export async function createAppJwt(appId: string, privateKeyPem: string, now: Date): Promise<string> {
  const issuedAt = Math.floor(now.getTime() / 1000) - 60;
  const key = createPrivateKey(privateKeyPem);
  return new SignJWT({})
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(appId)
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + 600)
    .sign(key);
}
