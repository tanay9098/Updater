import { describe, expect, it } from "vitest";
import { workspaceSchema } from "@/lib/validation/domain";
import { approveReviewItem } from "@/features/review/transitions";
import { updateProfile, updateProfileLinks, profileChecklist } from "@/features/profile/profile";
import { createEmptyWorkspace } from "@/features/workspace/workspace";
import { createResume, updateResume } from "@/features/resumes/drafts";
import { demoWorkspace, manualWorkspace, must, T0, T1, T2, workspaceWithProfile } from "@/test/fixtures";
import {
  addClaim,
  addProject,
  addSkill,
  deleteProject,
  moveProject,
  originAfterEdit,
  projectSummary,
  removeClaim,
  removeSkill,
  setProjectVisibility,
  updateClaimText,
  updateProject,
} from "./portfolio";

function approvedDemoProject() {
  const ws = demoWorkspace();
  const item = ws.reviewItems.find((candidate) => candidate.kind === "add_project" && candidate.proposedProject?.name === "tidepool")!;
  const outcome = must(approveReviewItem(ws, item.id, {}, T1));
  return { ws: outcome.workspace, projectId: outcome.projectId!, claimId: outcome.claimId! };
}

describe("profile (FR-PROF-01)", () => {
  it("creates and updates the profile, normalizing empty optional fields", () => {
    const ws = must(updateProfile(createEmptyWorkspace(), { name: "  Sam  ", headline: "", intro: "", location: " ", email: "" }, T0));
    expect(ws.profile).toMatchObject({ name: "Sam", headline: "", createdAt: T0 });
    expect(ws.profile).not.toHaveProperty("location");
    expect(ws.profile).not.toHaveProperty("email");
    const updated = must(updateProfile(ws, { name: "Sam", headline: "Dev", intro: "", location: "", email: "sam@example.com" }, T1));
    expect(updated.profile).toMatchObject({ id: ws.profile!.id, createdAt: T0, updatedAt: T1, email: "sam@example.com" });
  });

  it("returns field errors for invalid input", () => {
    const result = updateProfile(createEmptyWorkspace(), { name: "", headline: "x".repeat(141), intro: "", location: "", email: "nope" }, T0);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(Object.keys(result.fieldErrors ?? {})).toEqual(["name", "headline", "email"]);
  });

  it("validates links as http(s) URLs", () => {
    const ws = workspaceWithProfile();
    const bad = updateProfileLinks(ws, [{ label: "Blog", url: "javascript:alert(1)" }], T1);
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.fieldErrors).toHaveProperty("0.url");
    const good = must(updateProfileLinks(ws, [{ label: "Blog", url: "https://example.com/blog" }], T1));
    expect(good.profile?.links).toEqual([expect.objectContaining({ label: "Blog", url: "https://example.com/blog" })]);
  });

  it("reports completeness as a checklist, not a score (FR-PROF-02)", () => {
    const items = profileChecklist(workspaceWithProfile());
    expect(items.filter((item) => item.done).map((item) => item.id)).toEqual(["name"]);
  });
});

describe("claims (FR-EDIT-05, architecture.md §7.2)", () => {
  it("origin only ever moves from source to edited_from_source", () => {
    expect(originAfterEdit("source")).toBe("edited_from_source");
    expect(originAfterEdit("edited_from_source")).toBe("edited_from_source");
    expect(originAfterEdit("user")).toBe("user");
  });

  it("editing a source claim keeps its evidence and marks it edited", () => {
    const { ws, claimId } = approvedDemoProject();
    const before = ws.portfolio.claims.find((claim) => claim.id === claimId)!;
    const next = must(updateClaimText(ws, claimId, "Summarizes tide tables from CSV files.", T2));
    const after = next.portfolio.claims.find((claim) => claim.id === claimId)!;
    expect(after).toMatchObject({ origin: "edited_from_source", wording: "user", evidenceIds: before.evidenceIds });
    expect(next.portfolio.publishing.status).toBe("not_published");
  });

  it("editing the project summary edits its source claim", () => {
    const { ws, projectId, claimId } = approvedDemoProject();
    const next = must(
      updateProject(ws, projectId, { name: "tidepool", summary: "CLI for tide tables.", technologies: "Go", links: [] }, T2),
    );
    const project = next.portfolio.projects.find((candidate) => candidate.id === projectId)!;
    expect(projectSummary(next, project)).toMatchObject({ text: "CLI for tide tables.", claim: expect.objectContaining({ id: claimId, origin: "edited_from_source" }) });
    expect(project.technologies).toEqual(["Go"]);
    expect(project.links).toEqual([]);
  });

  it("adds user-supplied achievements without evidence and removes claims from resumes", () => {
    const { ws, projectId } = approvedDemoProject();
    const added = must(addClaim(ws, projectId, "Wrote the parser.", T2));
    const claim = added.workspace.portfolio.claims.find((candidate) => candidate.id === added.claimId)!;
    expect(claim).toMatchObject({ origin: "user", evidenceIds: [], projectId });
    expect(added.workspace.portfolio.projects.find((project) => project.id === projectId)!.claimIds).toContain(claim.id);

    const created = must(createResume(added.workspace, { targetRole: "Backend", name: "" }, T2));
    const withSelection = must(
      updateResume(created.workspace, created.resumeId, {
        name: "Backend", targetRole: "Backend", summary: "", projectIds: [projectId], claimIds: [claim.id], skillIds: [], overrides: { [claim.id]: "Wrote a parser." }, includeContact: false,
      }, T2),
    );
    const removed = must(removeClaim(withSelection, claim.id, T2));
    expect(removed.portfolio.claims.some((candidate) => candidate.id === claim.id)).toBe(false);
    expect(removed.portfolio.projects.find((project) => project.id === projectId)!.claimIds).not.toContain(claim.id);
    expect(removed.resumes[0]).toMatchObject({ claimIds: [], overrides: {} });
    expect(workspaceSchema.safeParse(removed).success).toBe(true);
  });
});

describe("projects (FR-PORT-02)", () => {
  it("adds, reorders, hides, and deletes projects; evidence survives deletion", () => {
    let ws = workspaceWithProfile();
    const a = must(addProject(ws, { name: "A", summary: "First", technologies: "" }, T0));
    const b = must(addProject(a.workspace, { name: "B", summary: "", technologies: "Go, go, Rust" }, T0));
    ws = b.workspace;
    expect(ws.portfolio.projects.map((project) => project.name)).toEqual(["A", "B"]);
    expect(ws.portfolio.projects[1].technologies).toEqual(["Go", "Rust"]);

    ws = must(moveProject(ws, b.projectId, "up", T1));
    expect(ws.portfolio.projects.map((project) => project.name)).toEqual(["B", "A"]);
    expect(moveProject(ws, b.projectId, "up", T1).ok).toBe(false);

    ws = must(setProjectVisibility(ws, a.projectId, false, T1));
    expect(ws.portfolio.projects.find((project) => project.id === a.projectId)!.visible).toBe(false);

    ws = must(deleteProject(ws, a.projectId, T2));
    expect(ws.portfolio.projects.map((project) => project.name)).toEqual(["B"]);
  });

  it("deleting an approved project removes its claims but keeps evidence and review history", () => {
    const { ws, projectId, claimId } = approvedDemoProject();
    const next = must(deleteProject(ws, projectId, T2));
    expect(next.portfolio.claims.some((claim) => claim.id === claimId)).toBe(false);
    expect(next.evidence).toEqual(ws.evidence);
    expect(next.reviewItems.find((item) => item.resultingClaimId === claimId)?.status).toBe("approved");
    expect(workspaceSchema.safeParse(next).success).toBe(true);
  });

  it("validates project input", () => {
    const result = addProject(workspaceWithProfile(), { name: "", summary: "", technologies: "" }, T0);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors).toHaveProperty("name");
  });
});

describe("skills", () => {
  it("adds user skills, refuses duplicates ignoring case, and removes them", () => {
    const added = must(addSkill(workspaceWithProfile(), "TypeScript", T0));
    expect(added.workspace.portfolio.skills[0]).toMatchObject({ name: "TypeScript", origin: "user", evidenceIds: [] });
    const duplicate = addSkill(added.workspace, "typescript", T0);
    expect(duplicate.ok).toBe(false);
    const removed = must(removeSkill(added.workspace, added.skillId, T1));
    expect(removed.portfolio.skills).toHaveLength(0);
  });
});

describe("manual project approval → portfolio (FR-EDIT-02)", () => {
  it("appears in the portfolio linked to the user's statement", () => {
    const { ws, reviewItemId } = manualWorkspace();
    const outcome = must(approveReviewItem(ws, reviewItemId, {}, T1));
    const project = outcome.workspace.portfolio.projects[0];
    expect(project.links).toEqual([expect.objectContaining({ url: "https://example.com/garden" })]);
    expect(projectSummary(outcome.workspace, project).claim?.evidenceIds).toEqual([ws.evidence[0].id]);
  });
});
