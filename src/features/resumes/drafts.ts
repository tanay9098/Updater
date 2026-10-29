import { z } from "zod";
import {
  claimTextSchema,
  resumeCreateInputSchema,
  resumeDetailsInputSchema,
  type ResumeCreateInput,
} from "@/lib/validation/domain";
import { validate } from "@/lib/validation/field-errors";
import { err, ok, type Result } from "@/lib/validation/result";
import { createId } from "@/lib/utils/ids";
import type { ExternalLink, PortfolioClaim, ResumeDraft, Workspace } from "@/types/domain";
import { appendActivity, quote } from "@/features/workspace/workspace";
import { projectSummary } from "@/features/portfolio/portfolio";
import type { ValidatedResult } from "@/features/profile/profile";

/**
 * Resume drafts (FR-RES-01/02/03). A resume is a selection over approved
 * portfolio content plus a user-written summary and per-resume wording
 * overrides. Nothing here generates text, and an override never changes the
 * underlying claim or its evidence.
 */

export function createResume(
  ws: Workspace,
  input: ResumeCreateInput,
  now: string,
): ValidatedResult<{ workspace: Workspace; resumeId: string }> {
  const parsed = validate(resumeCreateInputSchema, input);
  if (!parsed.ok) return parsed;
  const resume: ResumeDraft = {
    id: createId("res"),
    name: parsed.value.name || parsed.value.targetRole,
    targetRole: parsed.value.targetRole,
    summary: "",
    projectIds: [],
    claimIds: [],
    skillIds: [],
    overrides: {},
    includeContact: true,
    createdAt: now,
    updatedAt: now,
  };
  const next = appendActivity(
    { ...ws, resumes: [...ws.resumes, resume] },
    { type: "resume_created", summary: `Created the resume ${quote(resume.name)}`, refId: resume.id },
    now,
  );
  return ok({ workspace: next, resumeId: resume.id });
}

export type ResumeUpdate = {
  name: string;
  targetRole: string;
  summary: string;
  projectIds: string[];
  claimIds: string[];
  skillIds: string[];
  overrides: Record<string, string>;
  includeContact: boolean;
};

/**
 * Saves a resume draft. Selections must reference approved content that
 * still exists (FR-RES-02); empty overrides are dropped.
 */
export function updateResume(ws: Workspace, id: string, update: ResumeUpdate, now: string): ValidatedResult<Workspace> {
  const resume = ws.resumes.find((candidate) => candidate.id === id);
  if (!resume) return err("not_found", "That resume no longer exists.");
  const details = validate(resumeDetailsInputSchema, update);
  if (!details.ok) return details;

  const projectIds = new Set(ws.portfolio.projects.map((project) => project.id));
  const claimIds = new Set(ws.portfolio.claims.map((claim) => claim.id));
  const skillIds = new Set(ws.portfolio.skills.map((skill) => skill.id));
  if (update.projectIds.some((projectId) => !projectIds.has(projectId))) {
    return err("not_found", "A selected project no longer exists. Reload the page and try again.");
  }
  if (update.claimIds.some((claimId) => !claimIds.has(claimId))) {
    return err("not_found", "A selected achievement no longer exists. Reload the page and try again.");
  }
  if (update.skillIds.some((skillId) => !skillIds.has(skillId))) {
    return err("not_found", "A selected skill no longer exists. Reload the page and try again.");
  }

  const overrides: Record<string, string> = {};
  for (const [claimId, text] of Object.entries(update.overrides)) {
    const trimmed = text.trim();
    if (trimmed === "") continue;
    if (!claimIds.has(claimId)) continue;
    const parsed = z.string().pipe(claimTextSchema).safeParse(trimmed);
    if (!parsed.success) {
      const message = "Wording for this resume must be 500 characters or fewer.";
      return { ...err("validation_failed", message, `overrides.${claimId}`), fieldErrors: { [`overrides.${claimId}`]: message } };
    }
    overrides[claimId] = parsed.data;
  }

  const next: ResumeDraft = {
    ...resume,
    name: details.value.name,
    targetRole: details.value.targetRole,
    summary: details.value.summary,
    projectIds: unique(update.projectIds),
    claimIds: unique(update.claimIds),
    skillIds: unique(update.skillIds),
    overrides,
    includeContact: update.includeContact,
    updatedAt: now,
  };
  return ok(
    appendActivity(
      { ...ws, resumes: ws.resumes.map((candidate) => (candidate.id === id ? next : candidate)) },
      { type: "resume_saved", summary: `Saved the resume ${quote(next.name)}`, refId: id },
      now,
    ),
  );
}

export function renameResume(ws: Workspace, id: string, name: string, now: string): ValidatedResult<Workspace> {
  const resume = ws.resumes.find((candidate) => candidate.id === id);
  if (!resume) return err("not_found", "That resume no longer exists.");
  return updateResume(ws, id, { ...resume, name }, now);
}

export function duplicateResume(ws: Workspace, id: string, now: string): Result<{ workspace: Workspace; resumeId: string }> {
  const resume = ws.resumes.find((candidate) => candidate.id === id);
  if (!resume) return err("not_found", "That resume no longer exists.");
  const copy: ResumeDraft = {
    ...resume,
    id: createId("res"),
    name: `${resume.name} (copy)`.slice(0, 100),
    projectIds: [...resume.projectIds],
    claimIds: [...resume.claimIds],
    skillIds: [...resume.skillIds],
    overrides: { ...resume.overrides },
    createdAt: now,
    updatedAt: now,
  };
  const index = ws.resumes.findIndex((candidate) => candidate.id === id);
  const resumes = [...ws.resumes.slice(0, index + 1), copy, ...ws.resumes.slice(index + 1)];
  const next = appendActivity(
    { ...ws, resumes },
    { type: "resume_created", summary: `Duplicated the resume ${quote(resume.name)}`, refId: copy.id },
    now,
  );
  return ok({ workspace: next, resumeId: copy.id });
}

export function deleteResume(ws: Workspace, id: string, now: string): Result<Workspace> {
  const resume = ws.resumes.find((candidate) => candidate.id === id);
  if (!resume) return err("not_found", "That resume no longer exists.");
  return ok(
    appendActivity(
      { ...ws, resumes: ws.resumes.filter((candidate) => candidate.id !== id) },
      { type: "resume_deleted", summary: `Deleted the resume ${quote(resume.name)}`, refId: id },
      now,
    ),
  );
}

function unique(ids: ReadonlyArray<string>): string[] {
  return Array.from(new Set(ids));
}

// ---------------------------------------------------------------------------
// Resume document (preview and print)
// ---------------------------------------------------------------------------

export type ResumeEntry = { claimId: string; text: string; overridden: boolean; claim: PortfolioClaim };

export type ResumeDocument = {
  name: string;
  targetRole: string;
  headline: string;
  contact: { email?: string; location?: string; links: ExternalLink[] } | null;
  summary: string;
  projects: Array<{
    id: string;
    name: string;
    technologies: string[];
    links: ExternalLink[];
    summary?: ResumeEntry | { text: string; overridden: false; claim?: undefined; claimId?: undefined };
    achievements: ResumeEntry[];
    isDemo: boolean;
  }>;
  otherAchievements: ResumeEntry[];
  skills: Array<{ id: string; name: string; isDemo: boolean }>;
  hasDemoContent: boolean;
};

/**
 * Assembles what the preview and print view show. Only selected, approved
 * content appears. Achievements whose project is selected appear under it;
 * the rest appear under "Selected achievements".
 */
export function buildResumeDocument(ws: Workspace, resume: Pick<ResumeDraft, "name" | "targetRole" | "summary" | "projectIds" | "claimIds" | "skillIds" | "overrides" | "includeContact">): ResumeDocument {
  const profile = ws.profile;
  const claimsById = new Map(ws.portfolio.claims.map((claim) => [claim.id, claim]));
  const selectedClaims = new Set(resume.claimIds);
  const entry = (claim: PortfolioClaim): ResumeEntry => {
    const override = resume.overrides[claim.id];
    return { claimId: claim.id, text: override ?? claim.text, overridden: override !== undefined, claim };
  };

  const placed = new Set<string>();
  const projects = resume.projectIds
    .map((id) => ws.portfolio.projects.find((project) => project.id === id))
    .filter((project) => project !== undefined)
    .map((project) => {
      const summary = projectSummary(ws, project);
      const achievements = project.claimIds
        .filter((claimId) => selectedClaims.has(claimId))
        .map((claimId) => claimsById.get(claimId))
        .filter((claim) => claim !== undefined)
        .map(entry);
      achievements.forEach((achievement) => placed.add(achievement.claimId));
      return {
        id: project.id,
        name: project.name,
        technologies: project.technologies,
        links: project.links,
        ...(summary.claim
          ? { summary: entry(summary.claim) }
          : summary.text
            ? { summary: { text: summary.text, overridden: false as const } }
            : {}),
        achievements,
        isDemo: project.isDemo,
      };
    });

  const otherAchievements = resume.claimIds
    .filter((claimId) => !placed.has(claimId))
    .map((claimId) => claimsById.get(claimId))
    .filter((claim) => claim !== undefined)
    .map(entry);

  const skills = resume.skillIds
    .map((id) => ws.portfolio.skills.find((skill) => skill.id === id))
    .filter((skill) => skill !== undefined)
    .map((skill) => ({ id: skill.id, name: skill.name, isDemo: skill.isDemo }));

  return {
    name: profile?.name ?? "",
    targetRole: resume.targetRole,
    headline: profile?.headline ?? "",
    contact:
      resume.includeContact && profile
        ? {
            ...(profile.email ? { email: profile.email } : {}),
            ...(profile.location ? { location: profile.location } : {}),
            links: profile.links,
          }
        : null,
    summary: resume.summary,
    projects,
    otherAchievements,
    skills,
    hasDemoContent:
      projects.some((project) => project.isDemo) ||
      otherAchievements.some((achievement) => achievement.claim.isDemo) ||
      projects.some((project) => project.achievements.some((achievement) => achievement.claim.isDemo)) ||
      skills.some((skill) => skill.isDemo),
  };
}
