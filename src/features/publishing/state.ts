import { publishingStateSchema } from "@/lib/validation/domain";
import { err, ok, type Result } from "@/lib/validation/result";
import type { PublishingState, PublishingStatus, Workspace } from "@/types/domain";
import { appendActivity } from "@/features/workspace/workspace";

/**
 * Publishing state machine (architecture.md §7.4, T10.9). Pure: the
 * Portfolio page calls Updater's server, which writes to GitHub, and these
 * operations record what GitHub reported.
 *
 * - `start`: Updater committed the site to the developer's repository. The
 *   status is `publishing` until GitHub Pages reports the build.
 * - `confirm`: GitHub Pages built that commit. Only now is the site
 *   `published` and its address recorded (rules.md §7.1.9).
 * - `fail`: GitHub Pages reported a failed build, or the developer stopped
 *   waiting. The previously published copy, if any, is kept.
 *
 * Approval never calls any of these (rules.md §7.2.3).
 */

export type PublishingEvent = "start" | "confirm" | "fail";

const TRANSITIONS: Record<PublishingStatus, Partial<Record<PublishingEvent, PublishingStatus>>> = {
  not_published: { start: "publishing" },
  // Publishing again before GitHub answered replaces the pending commit.
  publishing: { start: "publishing", confirm: "published", fail: "failed" },
  published: { start: "publishing" },
  failed: { start: "publishing" },
};

export function nextPublishingStatus(from: PublishingStatus, event: PublishingEvent): PublishingStatus | null {
  return TRANSITIONS[from][event] ?? null;
}

type GithubPagesState = Extract<PublishingState, { publisherId: "github_pages" }>;

export function githubPagesState(ws: Workspace): GithubPagesState | null {
  const state = ws.portfolio.publishing;
  return state.publisherId === "github_pages" ? state : null;
}

function withPublishing(ws: Workspace, publishing: PublishingState): Result<Workspace> {
  const checked = publishingStateSchema.safeParse(publishing);
  if (!checked.success) return err("unexpected", "The publication record would be invalid, so it wasn't changed.");
  return ok({ ...ws, portfolio: { ...ws.portfolio, publishing } });
}

function refuse(status: PublishingStatus, event: PublishingEvent): Result<Workspace> {
  return err("invalid_transition", `Can't ${event} publishing while the portfolio is ${status.replace("_", " ")}.`);
}

/** Records the commit Updater wrote. A different repository is a different site, so its old copy isn't carried over. */
export function startPublishing(
  ws: Workspace,
  input: { repository: string; commitSha: string; contentHash: string },
  now: string,
): Result<Workspace> {
  const current = ws.portfolio.publishing;
  if (!nextPublishingStatus(current.status, "start")) return refuse(current.status, "start");
  const previous = current.publisherId === "github_pages" && sameRepository(current.repository, input.repository) ? current : null;
  return withPublishing(ws, {
    publisherId: "github_pages",
    status: "publishing",
    repository: input.repository,
    ...(previous?.live ? { live: previous.live } : {}),
    pending: { commitSha: input.commitSha, contentHash: input.contentHash, startedAt: now },
  });
}

/** Records GitHub Pages' confirmation that the pending commit was built and is live at `url`. */
export function confirmPublished(
  ws: Workspace,
  input: { commitSha: string; url: string; publishedAt: string },
  now: string,
): Result<Workspace> {
  const state = githubPagesState(ws);
  if (!state || !nextPublishingStatus(state.status, "confirm")) return refuse(ws.portfolio.publishing.status, "confirm");
  if (state.pending?.commitSha !== input.commitSha) {
    return err("invalid_transition", "GitHub confirmed a different publish than the one in progress.");
  }
  const next = withPublishing(ws, {
    publisherId: "github_pages",
    status: "published",
    repository: state.repository,
    live: { url: input.url, commitSha: input.commitSha, contentHash: state.pending.contentHash, publishedAt: input.publishedAt },
  });
  if (!next.ok) return next;
  return ok(appendActivity(next.value, { type: "portfolio_published", summary: `Published the portfolio to ${input.url}` }, now));
}

/** Records a failed or abandoned publish. The previously published copy stays live and recorded. */
export function recordPublishFailure(ws: Workspace, input: { message: string }, now: string): Result<Workspace> {
  const state = githubPagesState(ws);
  if (!state || !nextPublishingStatus(state.status, "fail")) return refuse(ws.portfolio.publishing.status, "fail");
  const message = input.message.replace(/\s+/g, " ").trim().slice(0, 300) || "Publishing failed.";
  const next = withPublishing(ws, {
    publisherId: "github_pages",
    status: "failed",
    repository: state.repository,
    ...(state.live ? { live: state.live } : {}),
    lastError: { at: now, message },
  });
  if (!next.ok) return next;
  return ok(appendActivity(next.value, { type: "portfolio_publish_failed", summary: `Publishing failed: ${message}` }, now));
}

/** True when the saved draft differs from the copy GitHub confirmed as live. */
export function hasUnpublishedChanges(ws: Workspace, contentHash: string): boolean {
  const live = githubPagesState(ws)?.live;
  return Boolean(live && live.contentHash !== contentHash);
}

export function sameRepository(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}
