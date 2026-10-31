import { err, ok, type Result } from "@/lib/validation/result";
import { publicPortfolioSchema, type PublicPortfolio } from "@/lib/validation/publication";
import type { Workspace } from "@/types/domain";
import { projectClaims, projectSummary, standaloneClaims } from "@/features/portfolio/portfolio";

/**
 * Builds the public copy of the saved portfolio draft (T10.9). It contains
 * what the local preview shows a visitor, minus demo content: demo data is
 * fictional and is never published as the developer's work (rules.md
 * §7.1.6). The email address is never included; the preview doesn't show
 * it either.
 */

export type PublicSnapshot = {
  portfolio: PublicPortfolio;
  /** Demo items left out, so the confirmation can say so. */
  leftOutDemo: number;
  contentHash: string;
};

export function buildPublicSnapshot(ws: Workspace): Result<PublicSnapshot> {
  const profile = ws.profile;
  if (!profile) return err("validation_failed", "Add your name in Profile and save it before publishing.");

  let leftOutDemo = 0;
  const keep = <T extends { isDemo: boolean }>(items: ReadonlyArray<T>): T[] =>
    items.filter((item) => {
      if (item.isDemo) leftOutDemo += 1;
      return !item.isDemo;
    });

  const skills = keep(ws.portfolio.skills.filter((skill) => skill.visible)).map((skill) => skill.name);
  const projects = keep(ws.portfolio.projects.filter((project) => project.visible)).map((project) => ({
    name: project.name,
    summary: projectSummary(ws, project).text,
    technologies: project.technologies.filter((technology) => technology.trim() !== ""),
    achievements: keep(projectClaims(ws, project)).map((claim) => claim.text),
    links: project.links.map((link) => ({ label: link.label, url: link.url })),
  }));
  const achievements = keep(standaloneClaims(ws)).map((claim) => claim.text);

  const parsed = publicPortfolioSchema.safeParse({
    profile: {
      name: profile.name,
      headline: profile.headline,
      intro: profile.intro,
      ...(profile.location ? { location: profile.location } : {}),
      links: profile.links.map((link) => ({ label: link.label, url: link.url })),
    },
    skills,
    projects,
    achievements,
  });
  if (!parsed.success) {
    return err("validation_failed", "Part of the portfolio can't be published as it is. Check the profile, links, and projects.");
  }
  return ok({ portfolio: parsed.data, leftOutDemo, contentHash: contentHashOf(parsed.data) });
}

/**
 * Fingerprint used only to tell whether the draft changed since the last
 * publish (FNV-1a, 32 bits). It is not a security measure.
 */
export function contentHashOf(portfolio: PublicPortfolio): string {
  const input = JSON.stringify(portfolio);
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

/** True when the public page is empty apart from the name. Publishing is still allowed; the dialog says so. */
export function isSparse(portfolio: PublicPortfolio): boolean {
  return (
    !portfolio.profile.headline &&
    !portfolio.profile.intro &&
    portfolio.profile.links.length === 0 &&
    portfolio.skills.length === 0 &&
    portfolio.projects.length === 0 &&
    portfolio.achievements.length === 0
  );
}
