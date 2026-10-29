import { describe, expect, it } from "vitest";
import { workspaceSchema } from "@/lib/validation/domain";
import type { ReviewStatus, Workspace } from "@/types/domain";
import { demoWorkspace, manualWorkspace, must, T1, T2 } from "@/test/fixtures";
import { addSkill } from "@/features/portfolio/portfolio";
import {
  approveReviewItem,
  canPerform,
  claimOriginFor,
  dismissReviewItem,
  editReviewItem,
  nextStatus,
  restoreReviewItem,
  revertReviewEdit,
  type ApproveOutcome,
  type ReviewAction,
} from "./transitions";
import type { Result } from "@/lib/validation/result";

/** Puts the manual entry's review item into the given status through allowed transitions only. */
function inStatus(status: ReviewStatus): { ws: Workspace; id: string } {
  const { ws, reviewItemId: id } = manualWorkspace();
  switch (status) {
    case "needs_review":
      return { ws, id };
    case "edited":
      return { ws: must(editReviewItem(ws, id, "Built a garden planner for a gardening club.", T1)), id };
    case "approved":
      return { ws: must(approveReviewItem(ws, id, {}, T1)).workspace, id };
    case "dismissed":
      return { ws: must(dismissReviewItem(ws, id, undefined, T1)), id };
  }
}

function perform(ws: Workspace, id: string, action: ReviewAction): Result<Workspace | ApproveOutcome> {
  switch (action) {
    case "edit":
      return editReviewItem(ws, id, "New wording.", T2);
    case "approve":
      return approveReviewItem(ws, id, {}, T2);
    case "dismiss":
      return dismissReviewItem(ws, id, "reason", T2);
    case "restore":
      return restoreReviewItem(ws, id, T2);
    case "revertEdit":
      return revertReviewEdit(ws, id, T2);
  }
}

const EXPECTED: Record<ReviewStatus, Record<ReviewAction, ReviewStatus | null>> = {
  needs_review: { edit: "edited", approve: "approved", dismiss: "dismissed", restore: null, revertEdit: null },
  edited: { edit: "edited", approve: "approved", dismiss: "dismissed", restore: null, revertEdit: "needs_review" },
  approved: { edit: null, approve: null, dismiss: null, restore: null, revertEdit: null },
  dismissed: { edit: null, approve: null, dismiss: null, restore: "needs_review", revertEdit: null },
};

describe("review state machine (architecture.md §7.1)", () => {
  const cells = (Object.keys(EXPECTED) as ReviewStatus[]).flatMap((from) =>
    (Object.keys(EXPECTED[from]) as ReviewAction[]).map((action) => [from, action, EXPECTED[from][action]] as const),
  );

  it.each(cells)("%s --%s--> %s", (from, action, to) => {
    expect(nextStatus(from, action)).toBe(to);
    const { ws, id } = inStatus(from);
    const result = perform(ws, id, action);
    if (to === null) {
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("invalid_transition");
      return;
    }
    const next = must(result);
    const workspace = "workspace" in next ? next.workspace : next;
    expect(workspace.reviewItems.find((item) => item.id === id)?.status).toBe(to);
    expect(workspaceSchema.safeParse(workspace).success).toBe(true);
  });

  it("refuses an unknown item with not_found", () => {
    const { ws } = manualWorkspace();
    const result = approveReviewItem(ws, "rev_missing", {}, T1);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("not_found");
  });

  it("leaves the workspace untouched when a transition is refused", () => {
    const { ws, id } = inStatus("approved");
    const before = JSON.stringify(ws);
    expect(dismissReviewItem(ws, id, undefined, T2).ok).toBe(false);
    expect(JSON.stringify(ws)).toBe(before);
  });
});

describe("edit", () => {
  it("keeps the original proposal and stores the edit separately (FR-EDIT-01)", () => {
    const { ws, id } = inStatus("needs_review");
    const original = ws.reviewItems.find((item) => item.id === id)!.proposedText;
    const next = must(editReviewItem(ws, id, "  Built a garden planner.  ", T1));
    const item = next.reviewItems.find((candidate) => candidate.id === id)!;
    expect(item.proposedText).toBe(original);
    expect(item.editedText).toBe("Built a garden planner.");
    expect(canPerform(item, "revertEdit")).toBe(true);
  });

  it("rejects empty wording with a field error", () => {
    const { ws, id } = inStatus("needs_review");
    const result = editReviewItem(ws, id, "   ", T1);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatchObject({ code: "validation_failed", field: "text" });
  });

  it("limits skill proposals to a valid skill name", () => {
    const ws = demoWorkspace();
    const skill = ws.reviewItems.find((item) => item.kind === "add_skill")!;
    const result = editReviewItem(ws, skill.id, "x".repeat(41), T1);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors).toEqual({ text: "Skill must be 40 characters or fewer." });
    const approved = must(approveReviewItem(must(editReviewItem(ws, skill.id, "TS", T1)), skill.id, { acknowledgeConflict: true }, T2));
    expect(workspaceSchema.safeParse(approved.workspace).success).toBe(true);
  });

  it("revert clears the edit and returns to needs review", () => {
    const { ws, id } = inStatus("edited");
    const item = must(revertReviewEdit(ws, id, T2)).reviewItems.find((candidate) => candidate.id === id)!;
    expect(item.status).toBe("needs_review");
    expect(item.editedText).toBeUndefined();
  });
});

describe("approve", () => {
  it("adds a project and its summary claim linked to evidence, and leaves publishing untouched (FR-EDIT-02/04)", () => {
    const { ws, id } = inStatus("needs_review");
    const before = ws.portfolio.publishing;
    const outcome = must(approveReviewItem(ws, id, {}, T1));
    const project = outcome.workspace.portfolio.projects.find((candidate) => candidate.id === outcome.projectId)!;
    const claim = outcome.workspace.portfolio.claims.find((candidate) => candidate.id === outcome.claimId)!;
    const item = outcome.workspace.reviewItems.find((candidate) => candidate.id === id)!;

    expect(project.name).toBe("Garden planner");
    expect(project.technologies).toEqual(["TypeScript", "SQLite"]);
    expect(project.summaryClaimId).toBe(claim.id);
    expect(claim.evidenceIds).toEqual(item.evidenceIds);
    expect(claim.evidenceIds.length).toBeGreaterThan(0);
    expect(claim.publishedAt).toBeUndefined();
    expect(item).toMatchObject({ status: "approved", decidedAt: T1, resultingClaimId: claim.id, resultingProjectId: project.id });
    expect(outcome.workspace.portfolio.publishing).toEqual(before);
    expect(outcome.workspace.portfolio.publishing).toEqual({ publisherId: null, status: "not_published" });
  });

  it("uses the edited wording and marks source claims as edited", () => {
    const ws = demoWorkspace();
    const pr = ws.reviewItems.find((item) => item.kind === "add_claim" && item.wording === "template")!;
    expect(claimOriginFor(ws, pr)).toBe("source");
    const edited = must(editReviewItem(ws, pr.id, "Added retry with backoff to a cache client.", T1));
    const outcome = must(approveReviewItem(edited, pr.id, {}, T2));
    const claim = outcome.workspace.portfolio.claims.find((candidate) => candidate.id === outcome.claimId)!;
    expect(claim).toMatchObject({ text: "Added retry with backoff to a cache client.", origin: "edited_from_source", wording: "user" });
  });

  it("labels claims from manual entries as user-supplied", () => {
    const { ws, id } = inStatus("needs_review");
    const outcome = must(approveReviewItem(ws, id, {}, T1));
    expect(outcome.workspace.portfolio.claims[0].origin).toBe("user");
  });

  it("requires acknowledging conflicting evidence (FR-EVID-04)", () => {
    const ws = demoWorkspace();
    const conflicted = ws.reviewItems.find((item) =>
      ws.evidence.some((evidence) => item.evidenceIds.includes(evidence.id) && evidence.verification === "conflicting"),
    )!;
    expect(conflicted).toBeDefined();
    const refused = approveReviewItem(ws, conflicted.id, {}, T1);
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.error.code).toBe("conflict_unacknowledged");

    const approved = must(approveReviewItem(ws, conflicted.id, { acknowledgeConflict: true }, T1));
    const item = approved.workspace.reviewItems.find((candidate) => candidate.id === conflicted.id)!;
    expect(item.conflictAcknowledgedAt).toBe(T1);
    // Both conflicting records are still there.
    expect(approved.workspace.evidence.filter((evidence) => evidence.verification === "conflicting")).toHaveLength(2);
  });

  it("creates a source skill, or merges evidence into an existing skill of the same name", () => {
    const ws = demoWorkspace();
    const goItem = ws.reviewItems.find((item) => item.kind === "add_skill" && item.proposedText === "Go")!;
    const created = must(approveReviewItem(ws, goItem.id, {}, T1));
    expect(created.workspace.portfolio.skills).toEqual([
      expect.objectContaining({ name: "Go", origin: "source", evidenceIds: goItem.evidenceIds, isDemo: true }),
    ]);

    const withUserSkill = must(addSkill(ws, "typescript", T1)).workspace;
    const tsItem = ws.reviewItems.find((item) => item.kind === "add_skill" && item.proposedText === "TypeScript")!;
    const merged = must(approveReviewItem(withUserSkill, tsItem.id, { acknowledgeConflict: true }, T2));
    expect(merged.workspace.portfolio.skills).toHaveLength(1);
    expect(merged.workspace.portfolio.skills[0]).toMatchObject({ name: "typescript", origin: "user", evidenceIds: tsItem.evidenceIds });
    expect(merged.skillId).toBe(merged.workspace.portfolio.skills[0].id);
  });
});

describe("dismiss and restore", () => {
  it("keeps evidence and the source item, records the reason, and can be restored (FR-EDIT-03)", () => {
    const { ws, id } = inStatus("needs_review");
    const dismissed = must(dismissReviewItem(ws, id, " Not relevant ", T1));
    expect(dismissed.evidence).toEqual(ws.evidence);
    expect(dismissed.sourceItems).toEqual(ws.sourceItems);
    const item = dismissed.reviewItems.find((candidate) => candidate.id === id)!;
    expect(item).toMatchObject({ status: "dismissed", dismissReason: "Not relevant", decidedAt: T1 });

    const restored = must(restoreReviewItem(dismissed, id, T2)).reviewItems.find((candidate) => candidate.id === id)!;
    expect(restored.status).toBe("needs_review");
    expect(restored.dismissReason).toBeUndefined();
  });

  it("records nothing in the portfolio", () => {
    const { ws, id } = inStatus("needs_review");
    const dismissed = must(dismissReviewItem(ws, id, undefined, T1));
    expect(dismissed.portfolio).toEqual(ws.portfolio);
  });
});
