import { z } from "zod";
import { rawSourceItemSchema } from "@/features/sources/ingestion";
import type { GithubErrorCode } from "./repositories";

/**
 * The `/api/github/repositories` response, shared by the route and the
 * browser. The browser parses every response with this schema: the server
 * is ours, but the repository text in it came from GitHub and is untrusted
 * (rules.md §7.3.5). Ingestion validates each item again before storing it.
 */

const GITHUB_ERROR_CODES = [
  "invalid_username",
  "not_found",
  "rate_limited",
  "token_rejected",
  "provider_error",
  "unreachable",
] as const satisfies ReadonlyArray<GithubErrorCode>;

const rateLimitSchema = z.object({
  limit: z.number().int().nonnegative(),
  remaining: z.number().int().nonnegative(),
  resetAt: z.iso.datetime(),
});

const listingSchema = z.object({
  login: z.string().min(1).max(39),
  repositories: z
    .array(z.object({ item: rawSourceItemSchema.extend({ kind: z.literal("repository") }), pushedAt: z.iso.datetime().optional() }))
    .max(300),
  skipped: z.object({
    forks: z.number().int().nonnegative(),
    private: z.number().int().nonnegative(),
    invalid: z.number().int().nonnegative(),
  }),
  truncated: z.boolean(),
  rateLimit: rateLimitSchema.optional(),
});

export const githubResponseSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), value: listingSchema }),
  z.object({
    ok: z.literal(false),
    error: z.object({
      code: z.enum(GITHUB_ERROR_CODES),
      message: z.string().max(300),
      resetAt: z.iso.datetime().optional(),
    }),
  }),
]);

export type ParsedListing = z.infer<typeof listingSchema>;
/** The body the route sends. Typed from the schema, so the server can't drift from what the browser accepts. */
export type GithubResponseBody = z.input<typeof githubResponseSchema>;

/** What the browser can be told about a failed request: GitHub's own errors plus failures reaching Updater's server. */
export type RequestFailure = {
  code: GithubErrorCode | "signed_out" | "server_unavailable" | "bad_response";
  message: string;
  resetAt?: string;
};

export type RequestOutcome = { ok: true; value: ParsedListing } | { ok: false; error: RequestFailure };

export const GITHUB_REPOSITORIES_PATH = "/api/github/repositories";

/**
 * Browser side: asks Updater's server for a listing. Never contacts GitHub
 * directly, so the optional server token is used and never exposed.
 */
export async function requestGithubRepositories(
  username: string,
  fetchImpl: (input: string, init: RequestInit) => Promise<Response> = fetch,
): Promise<RequestOutcome> {
  let response: Response;
  try {
    response = await fetchImpl(`${GITHUB_REPOSITORIES_PATH}?${new URLSearchParams({ username }).toString()}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
  } catch {
    return {
      ok: false,
      error: { code: "server_unavailable", message: "Updater's server couldn't be reached. Check your connection and try again." },
    };
  }
  if (response.status === 401) {
    return { ok: false, error: { code: "signed_out", message: "Your session has ended. Sign in again to import." } };
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = undefined;
  }
  const parsed = githubResponseSchema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false,
      error:
        response.status === 503
          ? { code: "server_unavailable", message: "Updater's server isn't available right now. Try again later." }
          : { code: "bad_response", message: "Updater's server sent a response it couldn't read. Nothing was imported." },
    };
  }
  return parsed.data.ok ? { ok: true, value: parsed.data.value } : { ok: false, error: parsed.data.error };
}
