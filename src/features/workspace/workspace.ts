import { MAX_ACTIVITY_ENTRIES, WORKSPACE_SCHEMA_VERSION } from "@/lib/validation/domain";
import { createId } from "@/lib/utils/ids";
import type {
  ActivityType,
  Evidence,
  PortfolioClaim,
  ReviewItem,
  Source,
  SourceItem,
  Workspace,
} from "@/types/domain";

/**
 * Workspace document helpers and selectors. Pure: every operation takes the
 * current workspace (and `now` as an ISO string) and returns a new one.
 */

export function createEmptyWorkspace(): Workspace {
  return {
    schemaVersion: WORKSPACE_SCHEMA_VERSION,
    profile: null,
    onboarding: {},
    sources: [],
    sourceItems: [],
    evidence: [],
    reviewItems: [],
    portfolio: {
      projects: [],
      claims: [],
      skills: [],
      publishing: { publisherId: null, status: "not_published" },
    },
    resumes: [],
    activity: [],
  };
}

/** Records an action the user took in Updater. Bounded to the most recent entries. */
export function appendActivity(
  ws: Workspace,
  entry: { type: ActivityType; summary: string; refId?: string },
  now: string,
): Workspace {
  const activity = [
    { id: createId("act"), at: now, type: entry.type, summary: entry.summary.slice(0, 300), ...(entry.refId ? { refId: entry.refId } : {}) },
    ...ws.activity,
  ].slice(0, MAX_ACTIVITY_ENTRIES);
  return { ...ws, activity };
}

/** Quotes user or source text for activity summaries, shortened. */
export function quote(text: string, max = 60): string {
  const single = text.replace(/\s+/g, " ").trim();
  return `“${single.length > max ? `${single.slice(0, max - 1)}…` : single}”`;
}

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

export function findSourceItem(ws: Workspace, id: string): SourceItem | undefined {
  return ws.sourceItems.find((item) => item.id === id);
}

export function findSource(ws: Workspace, id: string): Source | undefined {
  return ws.sources.find((source) => source.id === id);
}

export function findEvidence(ws: Workspace, ids: ReadonlyArray<string>): Evidence[] {
  const wanted = new Set(ids);
  return ws.evidence.filter((evidence) => wanted.has(evidence.id));
}

export function evidenceForItem(ws: Workspace, sourceItemId: string): Evidence[] {
  return ws.evidence.filter((evidence) => evidence.sourceItemId === sourceItemId);
}

export function evidenceForClaim(ws: Workspace, claimId: string): Evidence[] {
  const claim = ws.portfolio.claims.find((candidate) => candidate.id === claimId);
  return claim ? findEvidence(ws, claim.evidenceIds) : [];
}

export function claimsForEvidence(ws: Workspace, evidenceId: string): PortfolioClaim[] {
  return ws.portfolio.claims.filter((claim) => claim.evidenceIds.includes(evidenceId));
}

/** Source item → source, for provenance display. */
export function provenanceOf(
  ws: Workspace,
  sourceItemId: string,
): { item: SourceItem; source: Source } | undefined {
  const item = findSourceItem(ws, sourceItemId);
  if (!item) return undefined;
  const source = findSource(ws, item.sourceId);
  return source ? { item, source } : undefined;
}

/** Source items behind a set of evidence IDs, de-duplicated, in evidence order. */
export function sourceItemsForEvidence(ws: Workspace, evidenceIds: ReadonlyArray<string>): SourceItem[] {
  const seen = new Set<string>();
  const items: SourceItem[] = [];
  for (const evidence of findEvidence(ws, evidenceIds)) {
    if (seen.has(evidence.sourceItemId)) continue;
    seen.add(evidence.sourceItemId);
    const item = findSourceItem(ws, evidence.sourceItemId);
    if (item) items.push(item);
  }
  return items;
}

export function isPending(item: ReviewItem): boolean {
  return item.status === "needs_review" || item.status === "edited";
}

export function pendingReviewCount(ws: Workspace): number {
  return ws.reviewItems.filter(isPending).length;
}

/** True while any demo-derived record exists (drives the top-bar indicator). */
export function hasDemoData(ws: Workspace): boolean {
  return (
    ws.sources.some((source) => source.isDemo) ||
    ws.portfolio.claims.some((claim) => claim.isDemo) ||
    ws.portfolio.projects.some((project) => project.isDemo) ||
    ws.portfolio.skills.some((skill) => skill.isDemo)
  );
}

/** Current wording of a review item: the user's edit if there is one, else the proposal. */
export function currentReviewText(item: ReviewItem): string {
  return item.editedText ?? item.proposedText;
}
