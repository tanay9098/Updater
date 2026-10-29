import { describe, expect, it } from "vitest";
import { approveReviewItem } from "@/features/review/transitions";
import { addSkill } from "@/features/portfolio/portfolio";
import { demoWorkspace, must, T1, T2 } from "@/test/fixtures";
import type { Workspace } from "@/types/domain";
import {
  buildResumeDocument,
  createResume,
  deleteResume,
  duplicateResume,
  renameResume,
  updateResume,
  type ResumeUpdate,
} from "./drafts";
import { roleTerms, suggestSelections, tokenize } from "./tailoring";

/** Demo workspace with every proposal approved (conflicts acknowledged). */
function approvedWorkspace(): Workspace {
  let ws = demoWorkspace();
  for (const item of ws.reviewItems) ws = must(approveReviewItem(ws, item.id, { acknowledgeConflict: true }, T1)).workspace;
  return ws;
}

function selectionFor(ws: Workspace, resumeId: string, patch: Partial<ResumeUpdate> = {}): ResumeUpdate {
  const resume = ws.resumes.find((candidate) => candidate.id === resumeId)!;
  return { ...resume, ...patch };
}

describe("resume drafts (FR-RES-01)", () => {
  it("creates a draft named after the role by default, with nothing selected and no generated text", () => {
    const created = must(createResume(approvedWorkspace(), { targetRole: " Backend Engineer ", name: "" }, T1));
    const resume = created.workspace.resumes[0];
    expect(resume).toMatchObject({ name: "Backend Engineer", targetRole: "Backend Engineer", summary: "", projectIds: [], claimIds: [], skillIds: [] });
  });

  it("requires a target role", () => {
    const result = createResume(approvedWorkspace(), { targetRole: "", name: "x" }, T1);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors).toHaveProperty("targetRole");
  });

  it("saves selections and summary, and persists them in the document", () => {
    const ws = approvedWorkspace();
    const created = must(createResume(ws, { targetRole: "Backend", name: "" }, T1));
    const project = created.workspace.portfolio.projects[0];
    const saved = must(
      updateResume(
        created.workspace,
        created.resumeId,
        selectionFor(created.workspace, created.resumeId, { summary: "  My own summary.  ", projectIds: [project.id, project.id] }),
        T2,
      ),
    );
    expect(saved.resumes[0]).toMatchObject({ summary: "My own summary.", projectIds: [project.id], updatedAt: T2 });
  });

  it("refuses selections that don't exist", () => {
    const created = must(createResume(approvedWorkspace(), { targetRole: "Backend", name: "" }, T1));
    const result = updateResume(created.workspace, created.resumeId, selectionFor(created.workspace, created.resumeId, { claimIds: ["claim_missing"] }), T2);
    expect(result.ok).toBe(false);
  });

  it("overrides never change the portfolio claim or its evidence (FR-RES-03)", () => {
    const ws = approvedWorkspace();
    const claim = ws.portfolio.claims.find((candidate) => !candidate.projectId && !ws.portfolio.projects.some((project) => project.summaryClaimId === candidate.id))!;
    const created = must(createResume(ws, { targetRole: "Writer", name: "" }, T1));
    const saved = must(
      updateResume(
        created.workspace,
        created.resumeId,
        selectionFor(created.workspace, created.resumeId, { claimIds: [claim.id], overrides: { [claim.id]: "Resume-only wording." } }),
        T2,
      ),
    );
    expect(saved.portfolio.claims).toEqual(created.workspace.portfolio.claims);
    expect(saved.evidence).toEqual(created.workspace.evidence);
    const doc = buildResumeDocument(saved, saved.resumes[0]);
    expect(doc.otherAchievements).toEqual([expect.objectContaining({ claimId: claim.id, text: "Resume-only wording.", overridden: true })]);
  });

  it("drops empty overrides", () => {
    const ws = approvedWorkspace();
    const claim = ws.portfolio.claims[0];
    const created = must(createResume(ws, { targetRole: "Any", name: "" }, T1));
    const saved = must(updateResume(created.workspace, created.resumeId, selectionFor(created.workspace, created.resumeId, { overrides: { [claim.id]: "   " } }), T2));
    expect(saved.resumes[0].overrides).toEqual({});
  });

  it("renames, duplicates, and deletes", () => {
    const created = must(createResume(approvedWorkspace(), { targetRole: "Backend", name: "" }, T1));
    const renamed = must(renameResume(created.workspace, created.resumeId, "Backend v2", T2));
    expect(renamed.resumes[0].name).toBe("Backend v2");
    const duplicated = must(duplicateResume(renamed, created.resumeId, T2));
    expect(duplicated.workspace.resumes.map((resume) => resume.name)).toEqual(["Backend v2", "Backend v2 (copy)"]);
    expect(duplicated.resumeId).not.toBe(created.resumeId);
    const deleted = must(deleteResume(duplicated.workspace, created.resumeId, T2));
    expect(deleted.resumes.map((resume) => resume.id)).toEqual([duplicated.resumeId]);
  });
});

describe("resume document", () => {
  it("places achievements under selected projects and labels demo content", () => {
    let ws = approvedWorkspace();
    ws = must(addSkill(ws, "SQL", T1)).workspace;
    const created = must(createResume(ws, { targetRole: "Backend", name: "" }, T1));
    const project = created.workspace.portfolio.projects[0];
    const skill = created.workspace.portfolio.skills.find((candidate) => candidate.name === "SQL")!;
    const doc = buildResumeDocument(created.workspace, {
      ...created.workspace.resumes[0],
      projectIds: [project.id],
      skillIds: [skill.id],
      includeContact: true,
    });
    expect(doc.name).toBe("Sam Rivera");
    expect(doc.projects).toHaveLength(1);
    expect(doc.projects[0].summary?.text).toBeTruthy();
    expect(doc.skills).toEqual([{ id: skill.id, name: "SQL", isDemo: false }]);
    expect(doc.hasDemoContent).toBe(true);
    expect(doc.contact).toEqual({ links: [] });
  });
});

describe("tailoring (FR-RES-05)", () => {
  it("tokenizes role titles and drops generic words", () => {
    expect(tokenize("Senior Backend Engineer (Go, C#)")).toEqual(["backend", "go", "c#"]);
    expect(roleTerms("Frontend Engineer").has("react")).toBe(true);
  });

  it("pre-selects matching approved items only and never changes text", () => {
    const ws = approvedWorkspace();
    const before = JSON.stringify(ws);
    const suggestion = suggestSelections(ws, "Backend Engineer", "cli");
    expect(JSON.stringify(ws)).toBe(before);
    const names = suggestion.projectIds.map((id) => ws.portfolio.projects.find((project) => project.id === id)!.name);
    expect(names).toContain("tidepool");
    expect(names).not.toContain("lantern-forms");
    const skills = suggestion.skillIds.map((id) => ws.portfolio.skills.find((skill) => skill.id === id)!.name);
    expect(skills).toEqual(["Go"]);
  });

  it("returns nothing for a role with no meaningful words", () => {
    expect(suggestSelections(approvedWorkspace(), "Senior Engineer")).toMatchObject({ projectIds: [], claimIds: [], skillIds: [] });
  });
});

describe("tailoring for frontend roles", () => {
  it("matches projects through role hints", () => {
    const ws = approvedWorkspace();
    const names = suggestSelections(ws, "Frontend Engineer").projectIds.map(
      (id) => ws.portfolio.projects.find((project) => project.id === id)!.name,
    );
    expect(names).toEqual(expect.arrayContaining(["trail-notes", "lantern-forms"]));
  });
});
