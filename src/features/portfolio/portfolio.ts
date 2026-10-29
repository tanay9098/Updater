import { z } from "zod";
import {
  claimTextSchema,
  externalLinkInputSchema,
  projectInputSchema,
  skillNameSchema,
  type ProjectInput,
} from "@/lib/validation/domain";
import { validate } from "@/lib/validation/field-errors";
import { err, ok, type Result } from "@/lib/validation/result";
import { createId } from "@/lib/utils/ids";
import type { PortfolioClaim, PortfolioProject, Workspace } from "@/types/domain";
import { appendActivity, quote } from "@/features/workspace/workspace";
import { pruneReferences } from "@/features/workspace/integrity";
import type { LinkInput, ValidatedResult } from "@/features/profile/profile";

/**
 * Portfolio draft operations (architecture.md §8.1, FR-PORT-01/02/04).
 * The portfolio holds only approved or user-authored content. None of these
 * operations touch publishing state: the MVP has no publisher.
 */

const projectLinksSchema = z.array(externalLinkInputSchema).max(10, "Add at most 10 links.");

function withPortfolio(ws: Workspace, patch: Partial<Workspace["portfolio"]>): Workspace {
  return { ...ws, portfolio: { ...ws.portfolio, ...patch } };
}

function findProject(ws: Workspace, id: string): Result<PortfolioProject> {
  const project = ws.portfolio.projects.find((candidate) => candidate.id === id);
  return project ? ok(project) : err("not_found", "That project no longer exists.");
}

function findClaim(ws: Workspace, id: string): Result<PortfolioClaim> {
  const claim = ws.portfolio.claims.find((candidate) => candidate.id === id);
  return claim ? ok(claim) : err("not_found", "That achievement no longer exists.");
}

/** A project the user writes directly in the editor. Its summary is the user's own wording. */
export function addProject(
  ws: Workspace,
  input: ProjectInput,
  now: string,
): ValidatedResult<{ workspace: Workspace; projectId: string }> {
  const parsed = validate(projectInputSchema, input);
  if (!parsed.ok) return parsed;
  const project: PortfolioProject = {
    id: createId("proj"),
    name: parsed.value.name,
    summary: parsed.value.summary,
    technologies: parsed.value.technologies,
    links: [],
    claimIds: [],
    sourceItemIds: [],
    visible: true,
    isDemo: false,
    createdAt: now,
    updatedAt: now,
  };
  const next = appendActivity(
    withPortfolio(ws, { projects: [...ws.portfolio.projects, project] }),
    { type: "project_added", summary: `Added the project ${quote(project.name)}`, refId: project.id },
    now,
  );
  return ok({ workspace: next, projectId: project.id });
}

/**
 * Updates a project's name, summary, technologies, and links. When the
 * summary comes from a source-backed claim, editing it edits that claim
 * (origin becomes `edited_from_source`, evidence links are kept).
 */
export function updateProject(
  ws: Workspace,
  id: string,
  input: ProjectInput & { links: ReadonlyArray<LinkInput> },
  now: string,
): ValidatedResult<Workspace> {
  const found = findProject(ws, id);
  if (!found.ok) return found;
  const parsed = validate(projectInputSchema, input);
  if (!parsed.ok) return parsed;
  const links = validate(projectLinksSchema, input.links.map(({ label, url }) => ({ label, url })));
  if (!links.ok) {
    return links.fieldErrors
      ? { ...links, fieldErrors: Object.fromEntries(Object.entries(links.fieldErrors).map(([key, value]) => [`links.${key}`, value])) }
      : links;
  }
  const project = found.value;
  let working = ws;
  let summary = parsed.value.summary;

  if (project.summaryClaimId) {
    const claim = ws.portfolio.claims.find((candidate) => candidate.id === project.summaryClaimId);
    if (claim && parsed.value.summary === "") {
      return err("validation_failed", "This summary comes from a source. Edit it, or remove the achievement instead.", "summary");
    }
    if (claim && claim.text !== parsed.value.summary) {
      const updated = updateClaimText(working, claim.id, parsed.value.summary, now);
      if (!updated.ok) return { ...updated, error: { ...updated.error, field: "summary" } };
      working = updated.value;
    }
    summary = project.summary;
  }

  const nextProject: PortfolioProject = {
    ...project,
    name: parsed.value.name,
    summary,
    technologies: parsed.value.technologies,
    links: links.value.map((link, index) => ({ id: input.links[index].id ?? createId("link"), ...link })),
    updatedAt: now,
  };
  return ok(
    appendActivity(
      withPortfolio(working, {
        projects: working.portfolio.projects.map((candidate) => (candidate.id === id ? nextProject : candidate)),
      }),
      { type: "project_updated", summary: `Updated the project ${quote(nextProject.name)}`, refId: id },
      now,
    ),
  );
}

export function setProjectVisibility(ws: Workspace, id: string, visible: boolean, now: string): Result<Workspace> {
  const found = findProject(ws, id);
  if (!found.ok) return found;
  return ok(
    appendActivity(
      withPortfolio(ws, {
        projects: ws.portfolio.projects.map((project) => (project.id === id ? { ...project, visible, updatedAt: now } : project)),
      }),
      {
        type: "project_updated",
        summary: `${visible ? "Showed" : "Hid"} the project ${quote(found.value.name)} ${visible ? "in" : "from"} the portfolio`,
        refId: id,
      },
      now,
    ),
  );
}

/** Moves a project one place up or down (buttons, not drag: WCAG 2.5.7). */
export function moveProject(ws: Workspace, id: string, direction: "up" | "down", now: string): Result<Workspace> {
  const projects = [...ws.portfolio.projects];
  const index = projects.findIndex((project) => project.id === id);
  if (index === -1) return err("not_found", "That project no longer exists.");
  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= projects.length) {
    return err("invalid_transition", `This project is already ${direction === "up" ? "first" : "last"}.`);
  }
  [projects[index], projects[target]] = [projects[target], projects[index]];
  return ok(
    appendActivity(
      withPortfolio(ws, { projects }),
      { type: "project_updated", summary: `Moved the project ${quote(projects[target].name)} ${direction}`, refId: id },
      now,
    ),
  );
}

/**
 * Deletes a project and the achievements under it. Evidence, source items,
 * and review history stay. Resumes that selected it are updated.
 */
export function deleteProject(ws: Workspace, id: string, now: string): Result<Workspace> {
  const found = findProject(ws, id);
  if (!found.ok) return found;
  const project = found.value;
  const removedClaims = new Set([...project.claimIds, ...(project.summaryClaimId ? [project.summaryClaimId] : [])]);
  const stripped = withPortfolio(ws, {
    projects: ws.portfolio.projects.filter((candidate) => candidate.id !== id),
    claims: ws.portfolio.claims.filter((claim) => !removedClaims.has(claim.id) && claim.projectId !== id),
  });
  const { workspace } = pruneReferences(stripped);
  return ok(
    appendActivity(workspace, { type: "project_deleted", summary: `Deleted the project ${quote(project.name)}`, refId: id }, now),
  );
}

/** An achievement the user writes directly. Origin `user`, labeled "User-supplied". */
export function addClaim(
  ws: Workspace,
  projectId: string | undefined,
  text: string,
  now: string,
): ValidatedResult<{ workspace: Workspace; claimId: string }> {
  if (projectId) {
    const found = findProject(ws, projectId);
    if (!found.ok) return found;
  }
  const parsed = validate(claimTextSchema, text);
  if (!parsed.ok) return { ...parsed, error: { ...parsed.error, field: "text" } };
  const claim: PortfolioClaim = {
    id: createId("claim"),
    text: parsed.value,
    origin: "user",
    wording: "user",
    evidenceIds: [],
    ...(projectId ? { projectId } : {}),
    approvedAt: now,
    isDemo: false,
    createdAt: now,
    updatedAt: now,
  };
  const projects = projectId
    ? ws.portfolio.projects.map((project) =>
        project.id === projectId ? { ...project, claimIds: [...project.claimIds, claim.id], updatedAt: now } : project,
      )
    : ws.portfolio.projects;
  const next = appendActivity(
    withPortfolio(ws, { projects, claims: [...ws.portfolio.claims, claim] }),
    { type: "claim_added", summary: `Added the achievement ${quote(claim.text)}`, refId: claim.id },
    now,
  );
  return ok({ workspace: next, claimId: claim.id });
}

/**
 * Origin after the user edits a claim (architecture.md §7.2): `source`
 * becomes `edited_from_source`; the others stay as they are. Origin never
 * changes back to `source`.
 */
export function originAfterEdit(origin: PortfolioClaim["origin"]): PortfolioClaim["origin"] {
  return origin === "source" ? "edited_from_source" : origin;
}

/** Edits an approved claim (FR-EDIT-05). Evidence links are kept. */
export function updateClaimText(ws: Workspace, id: string, text: string, now: string): ValidatedResult<Workspace> {
  const found = findClaim(ws, id);
  if (!found.ok) return found;
  const parsed = validate(claimTextSchema, text);
  if (!parsed.ok) return { ...parsed, error: { ...parsed.error, field: "text" } };
  const claim = found.value;
  if (claim.text === parsed.value) return ok(ws);
  const next: PortfolioClaim = {
    ...claim,
    text: parsed.value,
    origin: originAfterEdit(claim.origin),
    wording: "user",
    updatedAt: now,
  };
  return ok(
    appendActivity(
      withPortfolio(ws, { claims: ws.portfolio.claims.map((candidate) => (candidate.id === id ? next : candidate)) }),
      { type: "claim_updated", summary: `Edited the achievement ${quote(next.text)}`, refId: id },
      now,
    ),
  );
}

/** Removes a claim from the portfolio. Its evidence and review history stay. */
export function removeClaim(ws: Workspace, id: string, now: string): Result<Workspace> {
  const found = findClaim(ws, id);
  if (!found.ok) return found;
  const stripped = withPortfolio(ws, { claims: ws.portfolio.claims.filter((claim) => claim.id !== id) });
  const { workspace } = pruneReferences(stripped);
  return ok(
    appendActivity(workspace, { type: "claim_removed", summary: `Removed the achievement ${quote(found.value.text)}`, refId: id }, now),
  );
}

/** Adds a skill the user types. Duplicate names (ignoring case) are refused. */
export function addSkill(ws: Workspace, name: string, now: string): ValidatedResult<{ workspace: Workspace; skillId: string }> {
  const parsed = validate(skillNameSchema, name);
  if (!parsed.ok) return { ...parsed, error: { ...parsed.error, field: "name" } };
  const value = parsed.value;
  if (ws.portfolio.skills.some((skill) => skill.name.toLowerCase() === value.toLowerCase())) {
    return { ...err("validation_failed", `“${value}” is already in your skills.`, "name"), fieldErrors: { name: `“${value}” is already in your skills.` } };
  }
  const skillId = createId("skill");
  const next = appendActivity(
    withPortfolio(ws, {
      skills: [
        ...ws.portfolio.skills,
        { id: skillId, name: value, origin: "user", evidenceIds: [], visible: true, isDemo: false, createdAt: now, updatedAt: now },
      ],
    }),
    { type: "skill_added", summary: `Added the skill ${quote(value)}`, refId: skillId },
    now,
  );
  return ok({ workspace: next, skillId });
}

export function removeSkill(ws: Workspace, id: string, now: string): Result<Workspace> {
  const skill = ws.portfolio.skills.find((candidate) => candidate.id === id);
  if (!skill) return err("not_found", "That skill no longer exists.");
  const { workspace } = pruneReferences(withPortfolio(ws, { skills: ws.portfolio.skills.filter((candidate) => candidate.id !== id) }));
  return ok(appendActivity(workspace, { type: "skill_removed", summary: `Removed the skill ${quote(skill.name)}`, refId: id }, now));
}

/** Claim text shown as a project's summary: its summary claim, or the user's own summary. */
export function projectSummary(ws: Workspace, project: PortfolioProject): { text: string; claim?: PortfolioClaim } {
  const claim = project.summaryClaimId
    ? ws.portfolio.claims.find((candidate) => candidate.id === project.summaryClaimId)
    : undefined;
  return claim ? { text: claim.text, claim } : { text: project.summary };
}

/** Achievements under a project, in order. */
export function projectClaims(ws: Workspace, project: PortfolioProject): PortfolioClaim[] {
  return project.claimIds
    .map((id) => ws.portfolio.claims.find((claim) => claim.id === id))
    .filter((claim): claim is PortfolioClaim => claim !== undefined);
}

/** Approved claims that belong to no project (for example articles and standalone achievements). */
export function standaloneClaims(ws: Workspace): PortfolioClaim[] {
  const summaryIds = new Set(ws.portfolio.projects.map((project) => project.summaryClaimId).filter(Boolean));
  return ws.portfolio.claims.filter((claim) => !claim.projectId && !summaryIds.has(claim.id));
}
