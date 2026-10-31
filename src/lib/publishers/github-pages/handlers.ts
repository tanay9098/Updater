import { commitShaSchema } from "@/lib/validation/domain";
import { publishRequestSchema } from "@/lib/validation/publication";
import type { GithubAppConfig } from "./config";
import type { BuildStatusResponseBody, PublishResponseBody, SiteResponseBody } from "./contract";
import type { GithubDeps, PagesError, PagesErrorCode } from "./github-api";
import { buildStatus, inspectSite, publishSite, type SiteLink } from "./publisher";

/**
 * The publishing routes' work, apart from the session and cookies (T10.9):
 * the route files check who is signed in and read the link cookie, then
 * call these. Kept here so every answer is tested without a server.
 */

export type HandlerDeps = GithubDeps & { config: GithubAppConfig };
type Answer<T> = { status: number; body: T };

export function statusForPagesError(code: PagesErrorCode): number {
  switch (code) {
    case "invalid_request":
      return 400;
    case "not_linked":
    case "not_installed":
    case "repository_missing":
    case "repository_empty":
    case "branch_in_use":
    case "pages_source_conflict":
    case "branch_changed":
      return 409;
    case "authorization_failed":
      return 403;
    case "rate_limited":
      return 429;
    case "unreachable":
      return 504;
    case "not_configured":
      return 503;
    case "provider_error":
      return 502;
  }
}

function failure(error: PagesError): Answer<{ ok: false; error: PagesError }> {
  return { status: statusForPagesError(error.code), body: { ok: false, error } };
}

const NOT_CONFIGURED: PagesError = { code: "not_configured", message: "Publishing isn't set up on this server." };
const NOT_LINKED: PagesError = { code: "not_linked", message: "Connect your GitHub account first." };

export async function siteAnswer(deps: HandlerDeps, link: SiteLink | null): Promise<Answer<SiteResponseBody>> {
  if (deps.config.state !== "ready") return { status: 200, body: { state: "unavailable" } };
  if (!link) return { status: 200, body: { state: "not_linked" } };
  const inspected = await inspectSite(deps, deps.config, link);
  if (!inspected.ok) return { status: statusForPagesError(inspected.error.code), body: { state: "error", error: inspected.error } };
  const value = inspected.value;
  // The installation token stays on the server.
  if (value.state === "ready") return { status: 200, body: { state: "ready", site: value.site } };
  return { status: 200, body: value };
}

export async function publishAnswer(deps: HandlerDeps, link: SiteLink | null, rawBody: unknown): Promise<Answer<PublishResponseBody>> {
  if (deps.config.state !== "ready") return failure(NOT_CONFIGURED);
  if (!link) return failure(NOT_LINKED);
  const parsed = publishRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return failure({ code: "invalid_request", message: "The portfolio sent for publishing isn't valid. Reload the page and try again." });
  }
  const published = await publishSite(deps, deps.config, link, parsed.data.portfolio, parsed.data.confirm);
  if (!published.ok) return failure(published.error);
  return { status: 200, body: { ok: true, value: published.value } };
}

export async function buildStatusAnswer(
  deps: HandlerDeps,
  link: SiteLink | null,
  commit: string | null,
): Promise<Answer<BuildStatusResponseBody>> {
  if (deps.config.state !== "ready") return failure(NOT_CONFIGURED);
  if (!link) return failure(NOT_LINKED);
  const sha = commitShaSchema.safeParse(commit ?? "");
  if (!sha.success) return failure({ code: "invalid_request", message: "That isn't a commit Updater published." });
  const status = await buildStatus(deps, deps.config, link, sha.data);
  if (!status.ok) return failure(status.error);
  return { status: 200, body: { ok: true, value: status.value } };
}
