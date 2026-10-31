import { z } from "zod";
import type { RawSourceItem } from "@/features/sources/ingestion";
import { safeExternalUrl } from "@/lib/validation/url";
import type { GithubResponseBody } from "./contract";

/**
 * GitHub public repository import (T10.1, architecture.md §9). Runs on the
 * server only: `src/app/api/github/repositories/route.ts` calls it with the
 * platform `fetch` and the optional `GITHUB_TOKEN`, so the token never
 * reaches the browser (rules.md §7.3.3).
 *
 * Reads `GET /users/{username}/repos?type=owner`: public repositories the
 * account owns. Forks are left out (they are someone else's project until
 * the user changes them), and anything GitHub reports as private is dropped
 * defensively. Each repository is normalized into a raw source item; the
 * browser validates it again in `ingestItems` before storing anything.
 *
 * Pure apart from the injected `fetch`, so every outcome is unit tested.
 */

export const GITHUB_API_ORIGIN = "https://api.github.com";
export const GITHUB_API_VERSION = "2022-11-28";
/** 100 per page is GitHub's maximum. Three pages cap one import at 300 repositories and 3 requests. */
export const PER_PAGE = 100;
export const MAX_PAGES = 3;
export const REQUEST_TIMEOUT_MS = 10_000;

/**
 * GitHub usernames: 1–39 characters, letters, digits, and single hyphens,
 * not starting or ending with a hyphen. Organizations follow the same rule.
 * Validating this strictly is also what keeps the request on the fixed
 * `api.github.com` path (no path or query injection).
 */
export const githubUsernameSchema = z
  .string()
  .trim()
  .min(1, "Enter a GitHub username.")
  .max(39, "GitHub usernames are at most 39 characters.")
  .regex(/^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9]))*$/, {
    message: "Use letters, digits, and single hyphens only, without a leading or trailing hyphen.",
  });

/** A GitHub username as typed, with an optional leading "@". */
export function parseGithubUsername(input: string): { ok: true; username: string } | { ok: false; message: string } {
  const parsed = githubUsernameSchema.safeParse(input.trim().replace(/^@/, ""));
  return parsed.success ? { ok: true, username: parsed.data } : { ok: false, message: parsed.error.issues[0].message };
}

/** Only the fields Updater uses. Other fields GitHub sends are dropped. */
const githubRepositorySchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1).max(100),
  html_url: z.string(),
  description: z.string().nullable().optional(),
  fork: z.boolean(),
  private: z.boolean(),
  archived: z.boolean().optional(),
  language: z.string().nullable().optional(),
  topics: z.array(z.string()).optional(),
  license: z.object({ spdx_id: z.string().nullable().optional() }).nullable().optional(),
  created_at: z.iso.datetime(),
  pushed_at: z.iso.datetime().nullable().optional(),
  owner: z.object({ login: z.string() }),
});
type GithubRepository = z.infer<typeof githubRepositorySchema>;

export type RateLimit = { limit: number; remaining: number; resetAt: string };

/** One repository offered for import. `pushedAt` is shown in the list only and is not stored as evidence. */
export type RepositoryCandidate = { item: RawSourceItem & { kind: "repository" }; pushedAt?: string };

export type RepositoryListing = {
  /** The account name as GitHub spells it, or as typed when the account has no repositories. */
  login: string;
  repositories: RepositoryCandidate[];
  skipped: { forks: number; private: number; invalid: number };
  /** True when the account has more repositories than one import reads. */
  truncated: boolean;
  rateLimit?: RateLimit;
};

export type GithubErrorCode =
  | "invalid_username"
  | "not_found"
  | "rate_limited"
  | "token_rejected"
  | "provider_error"
  | "unreachable";

export type GithubError = { code: GithubErrorCode; message: string; resetAt?: string };

export type GithubResult = { ok: true; value: RepositoryListing } | { ok: false; error: GithubError };

type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

function failure(code: GithubErrorCode, message: string, resetAt?: string): GithubResult {
  return { ok: false, error: resetAt ? { code, message, resetAt } : { code, message } };
}

export function readRateLimit(headers: Headers): RateLimit | undefined {
  const limit = Number(headers.get("x-ratelimit-limit"));
  const remaining = Number(headers.get("x-ratelimit-remaining"));
  const reset = Number(headers.get("x-ratelimit-reset"));
  if (!headers.has("x-ratelimit-remaining") || ![limit, remaining, reset].every(Number.isFinite)) return undefined;
  return { limit, remaining, resetAt: new Date(reset * 1000).toISOString() };
}

/**
 * GitHub signals a primary rate limit with 403/429 and
 * `x-ratelimit-remaining: 0`, and a secondary limit with `retry-after`.
 * Returns when requests may resume, or undefined if this isn't a rate limit.
 */
export function rateLimitResetAt(response: Response, now: Date): string | undefined {
  if (response.status !== 403 && response.status !== 429) return undefined;
  const retryAfter = Number(response.headers.get("retry-after"));
  if (response.headers.has("retry-after") && Number.isFinite(retryAfter)) {
    return new Date(now.getTime() + retryAfter * 1000).toISOString();
  }
  const limit = readRateLimit(response.headers);
  if (limit && limit.remaining === 0) return limit.resetAt;
  // A 429 without headers is still a rate limit; GitHub's guidance is to wait at least a minute.
  if (response.status === 429) return new Date(now.getTime() + 60_000).toISOString();
  return undefined;
}

function hasNextPage(headers: Headers): boolean {
  // Only the presence of rel="next" is used; the URL in the header is never followed.
  return /<[^>]*>\s*;\s*rel="next"/.test(headers.get("link") ?? "");
}

const FACT_SAFE = (value: string, max: number) => value.replace(/\s+/g, " ").trim().slice(0, max);

/** Normalizes one repository into a raw source item (architecture.md §5.3). Returns null if its URL isn't GitHub's. */
export function toRawSourceItem(repo: GithubRepository): RepositoryCandidate | null {
  const url = safeExternalUrl(repo.html_url);
  if (!url) return null;
  const parsedUrl = new URL(url);
  if (parsedUrl.protocol !== "https:" || parsedUrl.hostname !== "github.com") return null;

  const metadata: RawSourceItem["metadata"] = { owner: repo.owner.login };
  const description = repo.description ? FACT_SAFE(repo.description, 500) : "";
  if (description) metadata.description = description;
  if (repo.language) metadata.language = FACT_SAFE(repo.language, 100);
  const topics = (repo.topics ?? []).map((topic) => FACT_SAFE(topic, 100)).filter(Boolean).slice(0, 50);
  if (topics.length > 0) metadata.topics = topics;
  const license = repo.license?.spdx_id;
  if (license && license !== "NOASSERTION") metadata.license = FACT_SAFE(license, 100);
  if (repo.archived) metadata.archived = true;

  return {
    item: {
      // GitHub's numeric id survives renames, so a renamed repository updates instead of duplicating.
      externalId: `repo:${repo.id}`,
      kind: "repository",
      title: repo.name,
      url,
      occurredAt: repo.created_at,
      metadata,
    },
    ...(repo.pushed_at ? { pushedAt: repo.pushed_at } : {}),
  };
}

export async function fetchPublicRepositories(
  usernameInput: string,
  options: { fetch: FetchLike; token?: string; now?: () => Date },
): Promise<GithubResult> {
  const parsed = parseGithubUsername(usernameInput);
  if (!parsed.ok) return failure("invalid_username", parsed.message);
  const username = parsed.username;
  const now = options.now ?? (() => new Date());

  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": GITHUB_API_VERSION,
    "User-Agent": "Updater",
  };
  const token = options.token?.trim();
  if (token) headers.Authorization = `Bearer ${token}`;

  const repositories: RepositoryCandidate[] = [];
  const skipped = { forks: 0, private: 0, invalid: 0 };
  let login: string | undefined;
  let rateLimit: RateLimit | undefined;
  let truncated = false;

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const url = `${GITHUB_API_ORIGIN}/users/${encodeURIComponent(username)}/repos?type=owner&sort=pushed&direction=desc&per_page=${PER_PAGE}&page=${page}`;
    let response: Response;
    try {
      response = await options.fetch(url, {
        headers,
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
      return failure(
        "unreachable",
        timedOut ? "GitHub didn't answer in time. Try again in a moment." : "Updater's server couldn't reach GitHub. Try again in a moment.",
      );
    }

    rateLimit = readRateLimit(response.headers) ?? rateLimit;
    const resetAt = rateLimitResetAt(response, now());
    if (resetAt) return failure("rate_limited", "GitHub's request limit for this server was reached.", resetAt);
    if (response.status === 404) {
      return failure("not_found", `GitHub has no user or organization named “${username}”.`);
    }
    if (response.status === 401) {
      return failure("token_rejected", "GitHub rejected the server's GITHUB_TOKEN. Replace or remove it, then restart the server.");
    }
    if (!response.ok) return failure("provider_error", `GitHub answered with an error (HTTP ${response.status}). Try again later.`);

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      return failure("provider_error", "GitHub's response wasn't in the expected format.");
    }
    if (!Array.isArray(body)) return failure("provider_error", "GitHub's response wasn't in the expected format.");

    for (const raw of body) {
      const repo = githubRepositorySchema.safeParse(raw);
      if (!repo.success) {
        skipped.invalid += 1;
        continue;
      }
      login ??= repo.data.owner.login;
      if (repo.data.private) {
        skipped.private += 1;
        continue;
      }
      if (repo.data.fork) {
        skipped.forks += 1;
        continue;
      }
      const candidate = toRawSourceItem(repo.data);
      if (candidate) repositories.push(candidate);
      else skipped.invalid += 1;
    }

    if (!hasNextPage(response.headers)) break;
    if (page === MAX_PAGES) truncated = true;
  }

  return {
    ok: true,
    value: {
      login: login && login.toLowerCase() === username.toLowerCase() ? login : username,
      repositories,
      skipped,
      truncated,
      ...(rateLimit ? { rateLimit } : {}),
    },
  };
}

/** HTTP status the route answers with for each failure. */
export function statusForGithubError(code: GithubErrorCode): number {
  switch (code) {
    case "invalid_username":
      return 400;
    case "not_found":
      return 404;
    case "rate_limited":
      return 429;
    case "unreachable":
      return 504;
    case "token_rejected":
    case "provider_error":
      return 502;
  }
}

/**
 * The route's work, apart from authentication: reads `username` from the
 * query, fetches, and shapes the response body. Kept here so it is tested
 * without a server.
 */
export async function repositoriesResponse(
  searchParams: URLSearchParams,
  options: { fetch: FetchLike; token?: string; now?: () => Date },
): Promise<{ status: number; body: GithubResponseBody }> {
  const result = await fetchPublicRepositories(searchParams.get("username") ?? "", options);
  if (result.ok) return { status: 200, body: result };
  return { status: statusForGithubError(result.error.code), body: result };
}
