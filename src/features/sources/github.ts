import { parseGithubUsername } from "@/lib/providers/github/repositories";
import type { RequestFailure } from "@/lib/providers/github/contract";
import { GITHUB_PROVIDER, findSourceForProvider } from "@/lib/providers/registry";
import { err, ok, type Result } from "@/lib/validation/result";
import { createId } from "@/lib/utils/ids";
import type { Source, Workspace } from "@/types/domain";
import { appendActivity } from "@/features/workspace/workspace";
import { pruneReferences } from "@/features/workspace/integrity";
import { ingestItems, type RawSourceItem, type Rejection } from "./ingestion";

/**
 * GitHub public repository import in the workspace (T10.1). The server lists
 * repositories (`/api/github/repositories`); these pure operations record
 * what the user chose to import, through the same ingestion pipeline as
 * every other source (architecture.md §7).
 *
 * The status is truthful (architecture.md §7.3): `connected` only after an
 * import succeeded, `needs_attention` after a later check failed. Nothing is
 * imported automatically and nothing runs in the background.
 */

export type GithubImportInput = {
  /** The account the listing came from, as GitHub spells it. */
  login: string;
  /** Every repository in the listing (untrusted; validated by ingestion). */
  repositories: ReadonlyArray<RawSourceItem>;
  /** New repositories the user selected. Already-imported ones in the listing are always refreshed. */
  selectedExternalIds: ReadonlyArray<string>;
};

export type GithubImportOutcome = {
  workspace: Workspace;
  added: number;
  updated: number;
  proposals: number;
  rejected: Rejection[];
};

function plural(count: number, one: string, many = `${one}s`) {
  return `${count} ${count === 1 ? one : many}`;
}

/** The GitHub source, if one exists. There is at most one per workspace. */
export function findGithubSource(ws: Workspace): Source | undefined {
  return findSourceForProvider(ws, "github");
}

/** External ids already imported from GitHub, so the dialog can mark them. */
export function importedGithubIds(ws: Workspace): Set<string> {
  const source = findGithubSource(ws);
  if (!source) return new Set();
  return new Set(ws.sourceItems.filter((item) => item.sourceId === source.id).map((item) => item.externalId));
}

export function importGithubRepositories(
  ws: Workspace,
  input: GithubImportInput,
  now: string,
): Result<GithubImportOutcome> {
  const login = parseGithubUsername(input.login);
  if (!login.ok) return err("validation_failed", login.message);

  const existing = findGithubSource(ws);
  if (existing?.accountLabel && existing.accountLabel.toLowerCase() !== login.username.toLowerCase()) {
    return err(
      "invalid_transition",
      `This workspace imports from @${existing.accountLabel}. Remove that GitHub source first to import from another account.`,
    );
  }

  const imported = importedGithubIds(ws);
  const selected = new Set(input.selectedExternalIds);
  const toIngest = input.repositories.filter((item) => selected.has(item.externalId) || imported.has(item.externalId));
  const newCount = toIngest.filter((item) => !imported.has(item.externalId)).length;
  if (newCount === 0 && !existing) return err("validation_failed", "Choose at least one repository to import.");

  const source: Source = existing ?? {
    id: createId("src"),
    providerId: "github",
    displayName: GITHUB_PROVIDER.displayName,
    status: "connected",
    isDemo: false,
    createdAt: now,
    updatedAt: now,
  };
  const withSource = existing ? ws : { ...ws, sources: [...ws.sources, source] };

  const ingested = ingestItems(withSource, source.id, toIngest, now);
  if (!ingested.ok) return ingested;
  const { added, updated, rejected, proposals } = ingested.value;

  if (!existing && added.length === 0) {
    return err("validation_failed", `None of the selected repositories could be imported: ${rejected[0]?.reason ?? "invalid data"}.`);
  }

  const parts = [
    added.length > 0 ? `imported ${plural(added.length, "new repository", "new repositories")}` : "no new repositories",
    updated.length > 0 ? `refreshed ${plural(updated.length, "imported repository", "imported repositories")}` : null,
    rejected.length > 0 ? `skipped ${plural(rejected.length, "invalid repository", "invalid repositories")}` : null,
  ].filter(Boolean);
  const message = parts.join(", ");

  const recorded: Source = {
    ...source,
    accountLabel: login.username,
    status: "connected",
    lastSync: {
      attemptedAt: now,
      outcome: "succeeded",
      message: `${message.charAt(0).toUpperCase()}${message.slice(1)}.`,
      itemCount: added.length + updated.length,
    },
    updatedAt: now,
  };
  const workspace = appendActivity(
    { ...ingested.value.workspace, sources: ingested.value.workspace.sources.map((s) => (s.id === source.id ? recorded : s)) },
    {
      type: "github_imported",
      summary: `GitHub @${login.username}: ${message}`,
      refId: source.id,
    },
    now,
  );
  return ok({ workspace, added: added.length, updated: updated.length, proposals: proposals.length, rejected });
}

/**
 * Which failures count as a failed check of the GitHub source. A session
 * that ended, Updater's own server being down, or a mistyped username say
 * nothing about the GitHub data, so they are shown but not recorded.
 */
export function failureToRecord(code: RequestFailure["code"]): "failed" | "rate_limited" | null {
  switch (code) {
    case "rate_limited":
      return "rate_limited";
    case "not_found":
    case "token_rejected":
    case "provider_error":
    case "unreachable":
    case "bad_response":
      return "failed";
    case "invalid_username":
    case "signed_out":
    case "server_unavailable":
      return null;
  }
}

/**
 * Records a failed check on an existing GitHub source (rules.md §7.5.4).
 * Imported data stays; the status becomes `needs_attention` until the next
 * successful import. Without a GitHub source there is nothing to record.
 */
export function recordGithubFailure(
  ws: Workspace,
  failure: { outcome: "failed" | "rate_limited"; message: string },
  now: string,
): Result<Workspace> {
  const source = findGithubSource(ws);
  if (!source) return err("not_found", "There is no GitHub source to update.");
  const recorded: Source = {
    ...source,
    status: "needs_attention",
    lastSync: { attemptedAt: now, outcome: failure.outcome, message: failure.message.slice(0, 500) },
    updatedAt: now,
  };
  return ok({ ...ws, sources: ws.sources.map((s) => (s.id === source.id ? recorded : s)) });
}

export type SourceRemovalSummary = {
  sourceItems: number;
  evidence: number;
  reviewItems: number;
  claims: number;
  projects: number;
  skills: number;
};

type Derived = {
  itemIds: Set<string>;
  evidenceIds: Set<string>;
  reviewIds: Set<string>;
  claimIds: Set<string>;
  projectIds: Set<string>;
  skillIds: Set<string>;
};

/**
 * Everything that exists only because of this source: its items, their
 * evidence and proposals, and approved content whose evidence all came from
 * it. Content that also cites other evidence is not counted; it only loses
 * the references to this source.
 */
function derivedFrom(ws: Workspace, sourceId: string): Derived {
  const itemIds = new Set(ws.sourceItems.filter((item) => item.sourceId === sourceId).map((item) => item.id));
  const evidenceIds = new Set(ws.evidence.filter((record) => itemIds.has(record.sourceItemId)).map((record) => record.id));
  const reviews = ws.reviewItems.filter((review) => itemIds.has(review.sourceItemId));
  const onlyFromSource = (ids: ReadonlyArray<string>) => ids.length > 0 && ids.every((id) => evidenceIds.has(id));
  return {
    itemIds,
    evidenceIds,
    reviewIds: new Set(reviews.map((review) => review.id)),
    claimIds: new Set(ws.portfolio.claims.filter((claim) => onlyFromSource(claim.evidenceIds)).map((claim) => claim.id)),
    projectIds: new Set(
      ws.portfolio.projects
        .filter((project) => project.sourceItemIds.length > 0 && project.sourceItemIds.every((id) => itemIds.has(id)))
        .map((project) => project.id),
    ),
    skillIds: new Set(ws.portfolio.skills.filter((skill) => onlyFromSource(skill.evidenceIds)).map((skill) => skill.id)),
  };
}

/** What removing the GitHub source would delete, for the confirmation dialog (rules.md §7.2.5). */
export function summarizeGithubData(ws: Workspace): SourceRemovalSummary | null {
  const source = findGithubSource(ws);
  if (!source) return null;
  const derived = derivedFrom(ws, source.id);
  return {
    sourceItems: derived.itemIds.size,
    evidence: derived.evidenceIds.size,
    reviewItems: derived.reviewIds.size,
    claims: derived.claimIds.size,
    projects: derived.projectIds.size,
    skills: derived.skillIds.size,
  };
}

/**
 * Removes the GitHub source with its items, evidence, and proposals. Approved
 * content that rests only on it is removed too, unless the user keeps it;
 * kept content is marked "source removed". Nothing is sent to GitHub: there
 * is no authorization to revoke for a public import.
 */
export function removeGithubSource(
  ws: Workspace,
  options: { keepApprovedContent: boolean },
  now: string,
): Result<Workspace> {
  const source = findGithubSource(ws);
  if (!source) return err("not_found", "There is no GitHub source to remove.");
  const derived = derivedFrom(ws, source.id);
  const keep = options.keepApprovedContent;

  const projects = ws.portfolio.projects
    .filter((project) => keep || !derived.projectIds.has(project.id))
    .map((project) => {
      const sourceItemIds = project.sourceItemIds.filter((id) => !derived.itemIds.has(id));
      if (sourceItemIds.length === project.sourceItemIds.length) return project;
      return { ...project, sourceItemIds, ...(derived.projectIds.has(project.id) ? { sourceRemoved: true } : {}) };
    });

  const stripped: Workspace = {
    ...ws,
    sources: ws.sources.filter((candidate) => candidate.id !== source.id),
    sourceItems: ws.sourceItems.filter((item) => !derived.itemIds.has(item.id)),
    evidence: ws.evidence.filter((record) => !derived.evidenceIds.has(record.id)),
    reviewItems: ws.reviewItems.filter((review) => !derived.reviewIds.has(review.id)),
    portfolio: {
      ...ws.portfolio,
      projects,
      claims: keep ? ws.portfolio.claims : ws.portfolio.claims.filter((claim) => !derived.claimIds.has(claim.id)),
      skills: keep ? ws.portfolio.skills : ws.portfolio.skills.filter((skill) => !derived.skillIds.has(skill.id)),
    },
  };
  // Drops the evidence references to this source and marks kept content "source removed".
  const { workspace } = pruneReferences(stripped);
  return ok(
    appendActivity(
      workspace,
      {
        type: "github_removed",
        summary: keep
          ? `Removed the GitHub source${source.accountLabel ? ` @${source.accountLabel}` : ""} and kept approved content`
          : `Removed the GitHub source${source.accountLabel ? ` @${source.accountLabel}` : ""}`,
        refId: source.id,
      },
      now,
    ),
  );
}
