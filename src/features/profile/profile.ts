import { z } from "zod";
import { externalLinkInputSchema, profileInputSchema, type ProfileInput } from "@/lib/validation/domain";
import { validate, type FieldErrors } from "@/lib/validation/field-errors";
import { err, ok, type Result } from "@/lib/validation/result";
import { createId } from "@/lib/utils/ids";
import type { ExternalLink, Workspace } from "@/types/domain";
import { appendActivity } from "@/features/workspace/workspace";

export type ValidatedResult<T> = Result<T> & { fieldErrors?: FieldErrors };

/** Creates or updates the profile (FR-PROF-01). Stores only what the user typed (FR-PROF-03). */
export function updateProfile(ws: Workspace, input: ProfileInput, now: string): ValidatedResult<Workspace> {
  const parsed = validate(profileInputSchema, input);
  if (!parsed.ok) return parsed;
  const values = parsed.value;
  const existing = ws.profile;
  const profile = {
    id: existing?.id ?? createId("prof"),
    name: values.name,
    headline: values.headline,
    intro: values.intro,
    ...(values.location ? { location: values.location } : {}),
    ...(values.email ? { email: values.email } : {}),
    links: existing?.links ?? [],
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  return ok(appendActivity({ ...ws, profile }, { type: "profile_updated", summary: "Updated your profile" }, now));
}

export type LinkInput = { id?: string; label: string; url: string };

const linksInputSchema = z.array(externalLinkInputSchema).max(20, "Add at most 20 links.");

/** Replaces the profile's external links in the given order. URLs must be http(s). */
export function updateProfileLinks(
  ws: Workspace,
  links: ReadonlyArray<LinkInput>,
  now: string,
): ValidatedResult<Workspace> {
  if (!ws.profile) return err("validation_failed", "Add your name before adding links.", "name");
  const parsed = validate(linksInputSchema, links.map(({ label, url }) => ({ label, url })));
  if (!parsed.ok) return parsed;
  const next: ExternalLink[] = parsed.value.map((link, index) => ({
    id: links[index].id ?? createId("link"),
    label: link.label,
    url: link.url,
  }));
  return ok(
    appendActivity(
      { ...ws, profile: { ...ws.profile, links: next, updatedAt: now } },
      { type: "profile_updated", summary: "Updated your profile links" },
      now,
    ),
  );
}

export type ProfileChecklistItem = { id: string; label: string; done: boolean; hint: string };

/**
 * Profile completeness from observable fields only (FR-PROF-02). Returns a
 * checklist, never an invented score.
 */
export function profileChecklist(ws: Workspace): ProfileChecklistItem[] {
  const profile = ws.profile;
  return [
    { id: "name", label: "Name", done: Boolean(profile?.name), hint: "Add your name" },
    { id: "headline", label: "Headline", done: Boolean(profile?.headline), hint: "Add a headline" },
    { id: "intro", label: "Introduction", done: Boolean(profile?.intro), hint: "Add an introduction" },
    { id: "links", label: "At least one link", done: (profile?.links.length ?? 0) > 0, hint: "Add a link" },
    {
      id: "project",
      label: "At least one visible project",
      done: ws.portfolio.projects.some((project) => project.visible),
      hint: "Approve or add a project",
    },
  ];
}
