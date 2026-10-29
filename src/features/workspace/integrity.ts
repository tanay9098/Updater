import type { Workspace } from "@/types/domain";

/**
 * Drops soft references to records that no longer exist (architecture.md
 * §5.9): resume selections, project claim lists, claim → project links, and
 * pending review targets. Returns readable notices for anything removed, so
 * the user can be told instead of the data silently changing.
 *
 * Hard references in the provenance chain (evidence → source item → source)
 * are not repaired here; a document that breaks them fails validation.
 */
export function pruneReferences(ws: Workspace): { workspace: Workspace; notices: string[] } {
  const notices: string[] = [];
  const projectIds = new Set(ws.portfolio.projects.map((project) => project.id));
  const claimIds = new Set(ws.portfolio.claims.map((claim) => claim.id));
  const skillIds = new Set(ws.portfolio.skills.map((skill) => skill.id));
  const evidenceIds = new Set(ws.evidence.map((evidence) => evidence.id));

  const claims = ws.portfolio.claims.map((claim) => {
    let next = claim;
    if (claim.projectId && !projectIds.has(claim.projectId)) {
      next = { ...next };
      delete next.projectId;
    }
    const keptEvidence = next.evidenceIds.filter((id) => evidenceIds.has(id));
    if (keptEvidence.length !== next.evidenceIds.length) {
      next = { ...next, evidenceIds: keptEvidence, ...(keptEvidence.length === 0 && next.origin !== "user" ? { sourceRemoved: true } : {}) };
    }
    return next;
  });

  const skills = ws.portfolio.skills.map((skill) => {
    const kept = skill.evidenceIds.filter((id) => evidenceIds.has(id));
    if (kept.length === skill.evidenceIds.length) return skill;
    return { ...skill, evidenceIds: kept, ...(kept.length === 0 && skill.origin === "source" ? { sourceRemoved: true } : {}) };
  });

  const projects = ws.portfolio.projects.map((project) => {
    const kept = project.claimIds.filter((id) => claimIds.has(id));
    const summaryMissing = project.summaryClaimId !== undefined && !claimIds.has(project.summaryClaimId);
    if (kept.length === project.claimIds.length && !summaryMissing) return project;
    const next = { ...project, claimIds: kept };
    if (summaryMissing) delete next.summaryClaimId;
    return next;
  });

  const reviewItems = ws.reviewItems.map((item) => {
    if (!item.targetProjectId || projectIds.has(item.targetProjectId)) return item;
    const next = { ...item };
    delete next.targetProjectId;
    return next;
  });

  const resumes = ws.resumes.map((resume) => {
    const projectsKept = resume.projectIds.filter((id) => projectIds.has(id));
    const claimsKept = resume.claimIds.filter((id) => claimIds.has(id));
    const skillsKept = resume.skillIds.filter((id) => skillIds.has(id));
    const overrides = Object.fromEntries(Object.entries(resume.overrides).filter(([id]) => claimIds.has(id)));
    const dropped =
      resume.projectIds.length - projectsKept.length +
      (resume.claimIds.length - claimsKept.length) +
      (resume.skillIds.length - skillsKept.length);
    if (dropped === 0 && Object.keys(overrides).length === Object.keys(resume.overrides).length) return resume;
    if (dropped > 0) {
      notices.push(
        `Resume “${resume.name}”: ${dropped} selection${dropped === 1 ? " was" : "s were"} removed because the content no longer exists.`,
      );
    }
    return { ...resume, projectIds: projectsKept, claimIds: claimsKept, skillIds: skillsKept, overrides };
  });

  return {
    workspace: { ...ws, reviewItems, portfolio: { ...ws.portfolio, projects, claims, skills }, resumes },
    notices,
  };
}
