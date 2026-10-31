import { z } from "zod";
import { commitShaSchema } from "@/lib/validation/domain";
import { externalUrlSchema } from "@/lib/validation/schemas";
import type { PublishRequest } from "@/lib/validation/publication";
import type { PagesErrorCode } from "./github-api";

/**
 * The publishing routes' responses (T10.9), shared by the server and the
 * browser. The browser parses every response with these schemas: the
 * server is Updater's own, but the names and addresses in them came from
 * GitHub (rules.md §7.3.5). This module has no server-only imports.
 */

export const CONNECT_PATH = "/api/github/app/connect";
export const SITE_PATH = "/api/portfolio/site";
export const PUBLISH_PATH = "/api/portfolio/publish";
export const BUILD_STATUS_PATH = "/api/portfolio/publish/status";

/** Where the GitHub callback sends the developer: `/portfolio?github=<outcome>`. */
export const CALLBACK_OUTCOMES = ["linked", "denied", "invalid", "failed", "unavailable"] as const;
export type CallbackOutcome = (typeof CALLBACK_OUTCOMES)[number];

const PAGES_ERROR_CODES = [
  "not_configured",
  "not_linked",
  "not_installed",
  "repository_missing",
  "repository_empty",
  "branch_in_use",
  "pages_source_conflict",
  "branch_changed",
  "authorization_failed",
  "invalid_request",
  "rate_limited",
  "provider_error",
  "unreachable",
] as const satisfies ReadonlyArray<PagesErrorCode>;

export const pagesErrorSchema = z.object({
  code: z.enum(PAGES_ERROR_CODES),
  message: z.string().max(400),
  resetAt: z.iso.datetime().optional(),
  currentSource: z.string().max(200).optional(),
});

const login = z.string().min(1).max(39);
const repository = z.string().min(3).max(141);

const pagesSettingsSchema = z.discriminatedUnion("state", [
  z.object({ state: z.literal("not_enabled") }),
  z.object({ state: z.literal("serving_updater"), url: externalUrlSchema }),
  z.object({ state: z.literal("serving_other"), url: externalUrlSchema, source: z.string().max(200) }),
]);

export const siteInfoSchema = z.object({
  login,
  repository,
  private: z.boolean(),
  siteUrl: externalUrlSchema,
  settingsUrl: externalUrlSchema,
  pages: pagesSettingsSchema,
});

export const siteResponseSchema = z.discriminatedUnion("state", [
  /** The server has no GitHub App configured, so publishing isn't offered. */
  z.object({ state: z.literal("unavailable") }),
  z.object({ state: z.literal("not_linked") }),
  z.object({ state: z.literal("not_installed"), login, installUrl: externalUrlSchema }),
  z.object({
    state: z.literal("repository_missing"),
    login,
    repository,
    installUrl: externalUrlSchema,
    createUrl: externalUrlSchema,
  }),
  z.object({ state: z.literal("ready"), site: siteInfoSchema }),
  z.object({ state: z.literal("error"), error: pagesErrorSchema }),
]);

export const publishResponseSchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    value: z.object({
      repository,
      commitSha: commitShaSchema,
      siteUrl: externalUrlSchema,
      settingsUrl: externalUrlSchema,
      pagesSetup: z.enum(["ready", "manual"]),
    }),
  }),
  z.object({ ok: z.literal(false), error: pagesErrorSchema }),
]);

export const buildStatusResponseSchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    value: z.discriminatedUnion("state", [
      z.object({ state: z.literal("building") }),
      z.object({ state: z.literal("built"), url: externalUrlSchema, builtAt: z.iso.datetime({ offset: true }) }),
      z.object({ state: z.literal("errored"), message: z.string().max(300) }),
      z.object({ state: z.literal("superseded") }),
      z.object({ state: z.literal("not_serving"), settingsUrl: externalUrlSchema }),
    ]),
  }),
  z.object({ ok: z.literal(false), error: pagesErrorSchema }),
]);

export type SiteResponse = z.infer<typeof siteResponseSchema>;
export type SiteResponseBody = z.input<typeof siteResponseSchema>;
export type SiteInfoView = z.infer<typeof siteInfoSchema>;
export type PublishResponse = z.infer<typeof publishResponseSchema>;
export type PublishResponseBody = z.input<typeof publishResponseSchema>;
export type BuildStatusResponse = z.infer<typeof buildStatusResponseSchema>;
export type BuildStatusResponseBody = z.input<typeof buildStatusResponseSchema>;
export type BuildState = Extract<BuildStatusResponse, { ok: true }>["value"];

/** What the browser can be told: the server's answer, or a failure reaching it. */
export type ClientFailure = {
  code: z.infer<typeof pagesErrorSchema>["code"] | "signed_out" | "server_unavailable" | "bad_response";
  message: string;
  resetAt?: string;
  currentSource?: string;
};

export type ClientOutcome<T> = { ok: true; value: T } | { ok: false; error: ClientFailure };

type FetchImpl = (input: string, init: RequestInit) => Promise<Response>;

async function call<T>(
  fetchImpl: FetchImpl,
  url: string,
  init: RequestInit,
  schema: z.ZodType<T>,
): Promise<ClientOutcome<T>> {
  let response: Response;
  try {
    response = await fetchImpl(url, { ...init, headers: { Accept: "application/json", ...init.headers }, cache: "no-store" });
  } catch {
    return { ok: false, error: { code: "server_unavailable", message: "Updater's server couldn't be reached. Check your connection and try again." } };
  }
  if (response.status === 401) {
    return { ok: false, error: { code: "signed_out", message: "Your session ended. Sign in again to continue." } };
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { ok: false, error: { code: "server_unavailable", message: "Updater's server didn't answer as expected. Try again in a moment." } };
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, error: { code: "bad_response", message: "Updater's server sent an answer this page couldn't read. Reload and try again." } };
  }
  return { ok: true, value: parsed.data };
}

export function requestSite(fetchImpl: FetchImpl = fetch): Promise<ClientOutcome<SiteResponse>> {
  return call(fetchImpl, SITE_PATH, { method: "GET" }, siteResponseSchema);
}

/** Forgets the linked GitHub account in this browser. It doesn't uninstall the app; that happens on GitHub. */
export function requestDisconnect(fetchImpl: FetchImpl = fetch): Promise<ClientOutcome<SiteResponse>> {
  return call(fetchImpl, SITE_PATH, { method: "DELETE" }, siteResponseSchema);
}

export async function requestPublish(body: PublishRequest, fetchImpl: FetchImpl = fetch): Promise<ClientOutcome<PublishResponse>> {
  return call(
    fetchImpl,
    PUBLISH_PATH,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
    publishResponseSchema,
  );
}

export function requestBuildStatus(commitSha: string, fetchImpl: FetchImpl = fetch): Promise<ClientOutcome<BuildStatusResponse>> {
  return call(fetchImpl, `${BUILD_STATUS_PATH}?${new URLSearchParams({ commit: commitSha }).toString()}`, { method: "GET" }, buildStatusResponseSchema);
}
