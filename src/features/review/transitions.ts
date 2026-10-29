import { dismissReasonSchema, reviewTextSchema, skillNameSchema } from "@/lib/validation/domain";
import { validate } from "@/lib/validation/field-errors";
import { err, ok, type Result } from "@/lib/validation/result";
import { createId } from "@/lib/utils/ids";
import type {
  ClaimOrigin,
  PortfolioClaim,
  PortfolioProject,
  ReviewItem,
  ReviewStatus,
  Skill,
  Workspace,
} from "@/types/domain";
import { appendActivity, currentReviewText, findEvidence, quote } from "@/features/workspace/workspace";
import type { ValidatedResult } from "@/features/profile/profile";

/**
 * Review state machine (architecture.md §7.1, FR-REV-03).
 *
 * | From \ Action  | edit      | approve   | dismiss   | restore      | revertEdit   |
 * | needs_review   | edited    | approved  | dismissed | ✗            | ✗            |
 * | edited         | edited    | approved  | dismissed | ✗            | needs_review |
 * | approved       | ✗         | ✗         | ✗         | ✗            | ✗            |
 * | dismissed      | ✗         | ✗         | ✗         | needs_review | ✗            |
 *
 * Disallowed transitions return `invalid_transition` and leave the
 * workspace unchanged. Approval never touches publishing state (FR-EDIT-04).
 * Dismissal never deletes evidence or source items (FR-EDIT-03).
 */

export type ReviewAction = "edit" | "approve" | "dismiss" | "restore" | "revertEdit";

const TRANSITIONS: Record<ReviewStatus, Partial<Record<ReviewAction, ReviewStatus>>> = {
  needs_review: { edit: "edited", approve: "approved", dismiss: "dismissed" },
  edited: { edit: "edited", approve: "approved", dismiss: "dismissed", revertEdit: "needs_review" },
  approved: {},
  dismissed: { restore: "needs_review" },
};

/** The status an action leads to, or `null` when the transition is not allowed. */
export function nextStatus(from: ReviewStatus, action: ReviewAction): ReviewStatus | null {
  return TRANSITIONS[from][action] ?? null;
}

export function canPerform(item: ReviewItem, action: ReviewAction): boolean {
  return nextStatus(item.status, action) !== null;
}

const ACTION_VERBS: Record<ReviewAction, string> = {
  edit: "edited",
  approve: "approved",
  dismiss: "dismissed",
  restore: "restored",
  revertEdit: "reverted",
};

const STATUS_NAMES: Record<ReviewStatus, string> = {
  needs_review: "needs review",
  edited: "is edited",
  approved: "is already approved",
  dismissed: "is dismissed",
};

function locate(ws: Workspace, id: string, action: ReviewAction): Result<ReviewItem> {
  const item = ws.reviewItems.find((candidate) => candidate.id === id);
  if (!item) return err("not_found", "That proposal no longer exists.");
  if (!canPerform(item, action)) {
    return err("invalid_transition", `This proposal ${STATUS_NAMES[item.status]}, so it can't be ${ACTION_VERBS[action]}.`);
  }
  return ok(item);
}

function replaceItem(ws: Workspace, next: ReviewItem): Workspace {
  return { ...ws, reviewItems: ws.reviewItems.map((item) => (item.id === next.id ? next : item)) };
}

/** Saves new wording. The original `proposedText` is kept for comparison (FR-EDIT-01). */
export function editReviewItem(ws: Workspace, id: string, text: string, now: string): ValidatedResult<Workspace> {
  const located = locate(ws, id, "edit");
  if (!located.ok) return located;
  const item = located.value;
  // A skill proposal's wording becomes the skill name, which has its own limits.
  const parsed = validate(item.kind === "add_skill" ? skillNameSchema : reviewTextSchema, text);
  if (!parsed.ok) return { ...parsed, error: { ...parsed.error, field: "text" }, fieldErrors: { text: parsed.error.message } };
  const next: ReviewItem = { ...item, status: "edited", editedText: parsed.value, updatedAt: now };
  return ok(
    appendActivity(replaceItem(ws, next), { type: "review_edited", summary: `Edited the proposal ${quote(next.editedText ?? "")}`, refId: id }, now),
  );
}

/** Drops the edit and returns to the original proposal. */
export function revertReviewEdit(ws: Workspace, id: string, now: string): Result<Workspace> {
  const located = locate(ws, id, "revertEdit");
  if (!located.ok) return located;
  const next: ReviewItem = { ...located.value, status: "needs_review", updatedAt: now };
  delete next.editedText;
  return ok(
    appendActivity(replaceItem(ws, next), { type: "review_edit_reverted", summary: `Reverted your edit of ${quote(next.proposedText)}`, refId: id }, now),
  );
}

/** Dismisses a proposal. Evidence and the source item stay in the workspace. */
export function dismissReviewItem(
  ws: Workspace,
  id: string,
  reason: string | undefined,
  now: string,
): ValidatedResult<Workspace> {
  const located = locate(ws, id, "dismiss");
  if (!located.ok) return located;
  const parsed = validate(dismissReasonSchema, reason ?? "");
  if (!parsed.ok) return { ...parsed, error: { ...parsed.error, field: "reason" } };
  const next: ReviewItem = { ...located.value, status: "dismissed", decidedAt: now, updatedAt: now };
  if (parsed.value) next.dismissReason = parsed.value;
  else delete next.dismissReason;
  return ok(
    appendActivity(replaceItem(ws, next), { type: "review_dismissed", summary: `Dismissed ${quote(currentReviewText(next))}`, refId: id }, now),
  );
}

/** Moves a dismissed proposal back to Needs review with its original wording. */
export function restoreReviewItem(ws: Workspace, id: string, now: string): Result<Workspace> {
  const located = locate(ws, id, "restore");
  if (!located.ok) return located;
  const next: ReviewItem = { ...located.value, status: "needs_review", updatedAt: now };
  delete next.dismissReason;
  delete next.decidedAt;
  delete next.editedText;
  return ok(
    appendActivity(replaceItem(ws, next), { type: "review_restored", summary: `Restored ${quote(next.proposedText)} to the Review Queue`, refId: id }, now),
  );
}

export function hasConflictingEvidence(ws: Workspace, item: ReviewItem): boolean {
  return findEvidence(ws, item.evidenceIds).some((evidence) => evidence.verification === "conflicting");
}

/**
 * Origin of the claim an approval creates (architecture.md §5.6). Evidence
 * the user asserted yields `user`; source evidence yields `source`, or
 * `edited_from_source` when the user changed the wording.
 */
export function claimOriginFor(ws: Workspace, item: ReviewItem): ClaimOrigin {
  const evidence = findEvidence(ws, item.evidenceIds);
  const userOnly = evidence.length > 0 && evidence.every((record) => record.verification === "user_asserted");
  if (userOnly) return "user";
  return item.status === "edited" ? "edited_from_source" : "source";
}

export type ApproveOutcome = {
  workspace: Workspace;
  claimId?: string;
  projectId?: string;
  skillId?: string;
};

/**
 * Approves a proposal and adds its content to the portfolio draft
 * (FR-EDIT-02): a project plus its summary claim, an achievement claim, or a
 * skill, each linked to the evidence. Proposals with conflicting evidence
 * need `acknowledgeConflict` (FR-EVID-04). Publishing state is not touched.
 */
export function approveReviewItem(
  ws: Workspace,
  id: string,
  options: { acknowledgeConflict?: boolean },
  now: string,
): Result<ApproveOutcome> {
  const located = locate(ws, id, "approve");
  if (!located.ok) return located;
  const item = located.value;
  const conflicting = hasConflictingEvidence(ws, item);
  if (conflicting && !options.acknowledgeConflict) {
    return err(
      "conflict_unacknowledged",
      "This proposal's evidence contains a conflict. Check it and confirm before approving.",
    );
  }

  const text = currentReviewText(item);
  const origin = claimOriginFor(ws, item);
  const wording = item.status === "edited" ? "user" : item.wording;
  const base = {
    ...item,
    status: "approved" as const,
    decidedAt: now,
    updatedAt: now,
    ...(conflicting ? { conflictAcknowledgedAt: now } : {}),
  };

  if (item.kind === "add_skill") {
    const existing = ws.portfolio.skills.find((skill) => skill.name.toLowerCase() === text.toLowerCase());
    let skills: Skill[];
    let skillId: string;
    if (existing) {
      skillId = existing.id;
      skills = ws.portfolio.skills.map((skill) =>
        skill.id === existing.id
          ? { ...skill, evidenceIds: Array.from(new Set([...skill.evidenceIds, ...item.evidenceIds])), updatedAt: now }
          : skill,
      );
    } else {
      skillId = createId("skill");
      skills = [
        ...ws.portfolio.skills,
        {
          id: skillId,
          name: text,
          origin: origin === "user" ? "user" : "source",
          evidenceIds: [...item.evidenceIds],
          visible: true,
          reviewItemId: item.id,
          isDemo: item.isDemo,
          createdAt: now,
          updatedAt: now,
        },
      ];
    }
    const reviewed: ReviewItem = { ...base, resultingSkillId: skillId };
    const next = appendActivity(
      { ...replaceItem(ws, reviewed), portfolio: { ...ws.portfolio, skills } },
      { type: "review_approved", summary: `Approved the skill ${quote(text)}`, refId: skillId },
      now,
    );
    return ok({ workspace: next, skillId });
  }

  const claimId = createId("claim");
  const projectId =
    item.kind === "add_project"
      ? createId("proj")
      : item.targetProjectId && ws.portfolio.projects.some((project) => project.id === item.targetProjectId)
        ? item.targetProjectId
        : undefined;

  const claim: PortfolioClaim = {
    id: claimId,
    text,
    origin,
    wording,
    evidenceIds: [...item.evidenceIds],
    ...(projectId ? { projectId } : {}),
    reviewItemId: item.id,
    approvedAt: now,
    isDemo: item.isDemo,
    createdAt: now,
    updatedAt: now,
  };

  let projects = ws.portfolio.projects;
  if (item.kind === "add_project" && item.proposedProject && projectId) {
    const project: PortfolioProject = {
      id: projectId,
      name: item.proposedProject.name,
      summary: "",
      summaryClaimId: claimId,
      technologies: [...item.proposedProject.technologies],
      links: item.proposedProject.links.map((link) => ({ ...link })),
      claimIds: [],
      sourceItemIds: [item.sourceItemId],
      visible: true,
      isDemo: item.isDemo,
      createdAt: now,
      updatedAt: now,
    };
    projects = [...projects, project];
  } else if (projectId) {
    projects = projects.map((project) =>
      project.id === projectId
        ? {
            ...project,
            claimIds: [...project.claimIds, claimId],
            sourceItemIds: project.sourceItemIds.includes(item.sourceItemId)
              ? project.sourceItemIds
              : [...project.sourceItemIds, item.sourceItemId],
            updatedAt: now,
          }
        : project,
    );
  }

  const reviewed: ReviewItem = {
    ...base,
    resultingClaimId: claimId,
    ...(item.kind === "add_project" && projectId ? { resultingProjectId: projectId } : {}),
  };
  const summary =
    item.kind === "add_project"
      ? `Approved the project ${quote(item.proposedProject?.name ?? text)}`
      : `Approved the achievement ${quote(text)}`;
  const next = appendActivity(
    {
      ...replaceItem(ws, reviewed),
      portfolio: { ...ws.portfolio, projects, claims: [...ws.portfolio.claims, claim] },
    },
    { type: "review_approved", summary, refId: projectId ?? claimId },
    now,
  );
  return ok({ workspace: next, claimId, ...(item.kind === "add_project" ? { projectId } : {}) });
}
