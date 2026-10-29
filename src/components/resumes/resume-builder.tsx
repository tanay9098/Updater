"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowDown, ArrowLeft, ArrowUp, Printer, Wand2 } from "lucide-react";
import { formatDateTime } from "@/lib/utils/dates";
import type { FieldErrors } from "@/lib/validation/field-errors";
import { buildResumeDocument, updateResume, type ResumeUpdate } from "@/features/resumes/drafts";
import { suggestSelections } from "@/features/resumes/tailoring";
import { projectClaims, projectSummary, standaloneClaims } from "@/features/portfolio/portfolio";
import { pendingReviewCount } from "@/features/workspace/workspace";
import type { PortfolioClaim, ResumeDraft, Workspace } from "@/types/domain";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Panel } from "@/components/ui/panel";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useMediaQuery } from "@/components/hooks/use-media-query";
import { useUnsavedWarning } from "@/components/hooks/use-unsaved-warning";
import { DemoBadge, OriginBadge } from "@/components/workspace/badges";
import { useWorkspace, useWorkspaceAction } from "@/components/workspace/workspace-provider";
import { WorkspaceGate } from "@/components/workspace/workspace-gate";
import { UnsavedNote } from "@/components/portfolio/profile-section";
import { ResumeDocumentView } from "./resume-document";

/** Reads the route param (inside Suspense, see architecture.md §4.1) and loads the draft. */
export function ResumeBuilderRoute() {
  const params = useParams<{ resumeId: string }>();
  return (
    <WorkspaceGate>
      <ResumeBuilderLoader resumeId={params.resumeId} />
    </WorkspaceGate>
  );
}

function ResumeBuilderLoader({ resumeId }: { resumeId: string }) {
  const ws = useWorkspace();
  const resume = ws.resumes.find((candidate) => candidate.id === resumeId);
  if (!resume) {
    return (
      <EmptyState
        title="Resume not found"
        description="It may have been deleted, or it was created in another browser. Resumes are stored only in the browser where you made them."
        action={
          <Button asChild variant="primary">
            <Link href="/resumes">Back to Resumes</Link>
          </Button>
        }
      />
    );
  }
  // Remount the editor when the saved draft changes, so it always starts from saved values.
  return <ResumeBuilder key={resume.updatedAt} ws={ws} resume={resume} />;
}

function toUpdate(resume: ResumeDraft): ResumeUpdate {
  return {
    name: resume.name,
    targetRole: resume.targetRole,
    summary: resume.summary,
    projectIds: [...resume.projectIds],
    claimIds: [...resume.claimIds],
    skillIds: [...resume.skillIds],
    overrides: { ...resume.overrides },
    includeContact: resume.includeContact,
  };
}

function toggle(ids: string[], id: string, on: boolean): string[] {
  return on ? (ids.includes(id) ? ids : [...ids, id]) : ids.filter((candidate) => candidate !== id);
}

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

/**
 * Resume builder (design.md §12, FR-RES-02/03/04). Edits are local until
 * "Save draft"; the preview shows the current edits. Nothing here writes
 * resume text for the user.
 */
function ResumeBuilder({ ws, resume }: { ws: Workspace; resume: ResumeDraft }) {
  const run = useWorkspaceAction();
  const wide = useMediaQuery("(min-width: 80rem)");
  const [tab, setTab] = useState("edit");
  const [draft, setDraft] = useState<ResumeUpdate>(() => toUpdate(resume));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [keywords, setKeywords] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const dirty = JSON.stringify(draft) !== JSON.stringify(toUpdate(resume));
  useUnsavedWarning(dirty);

  const doc = buildResumeDocument(ws, draft);
  const pending = pendingReviewCount(ws);
  const projects = ws.portfolio.projects;
  const skills = ws.portfolio.skills.filter((skill) => skill.visible);
  const other = standaloneClaims(ws);

  function patch(update: Partial<ResumeUpdate>) {
    setDraft((current) => ({ ...current, ...update }));
  }

  function save(event?: FormEvent) {
    event?.preventDefault();
    const outcome = run((current, now) => updateResume(current, resume.id, draft, now), {
      success: { title: "Resume draft saved", description: "Saved in this browser." },
    });
    if (!outcome.ok && !outcome.applied) {
      setErrors(outcome.fieldErrors ?? { "": outcome.error.message });
    }
  }

  function suggest() {
    const suggestion = suggestSelections(ws, draft.targetRole, keywords);
    patch({ projectIds: suggestion.projectIds, claimIds: suggestion.claimIds, skillIds: suggestion.skillIds });
    const total = suggestion.projectIds.length + suggestion.claimIds.length + suggestion.skillIds.length;
    setAnnouncement(
      total === 0
        ? `Nothing in your approved content matches “${draft.targetRole}”${keywords ? ` or “${keywords}”` : ""}. Selections were cleared; choose items below.`
        : `Selected ${plural(suggestion.projectIds.length, "project", "projects")}, ${plural(
            suggestion.claimIds.length,
            "achievement",
            "achievements",
          )}, and ${plural(suggestion.skillIds.length, "skill", "skills")} based on “${draft.targetRole}”. Review the selections below. Not saved yet.`,
    );
  }

  function moveProject(id: string, offset: -1 | 1) {
    const ids = [...draft.projectIds];
    const index = ids.indexOf(id);
    const target = index + offset;
    if (index < 0 || target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    patch({ projectIds: ids });
  }

  function claimOption(claim: PortfolioClaim) {
    const selected = draft.claimIds.includes(claim.id);
    const short = claim.text.length > 60 ? `${claim.text.slice(0, 59)}…` : claim.text;
    return (
      <li key={claim.id} className="flex flex-col gap-2 py-2.5">
        <Checkbox
          label={claim.text}
          hint={
            <span className="mt-1 flex flex-wrap items-center gap-2">
              <OriginBadge origin={claim.origin} />
              {claim.isDemo ? <DemoBadge /> : null}
            </span>
          }
          checked={selected}
          onCheckedChange={(value) => patch({ claimIds: toggle(draft.claimIds, claim.id, value === true) })}
        />
        {selected ? (
          <OverrideField
            claim={claim}
            label={`Wording for this resume only (${short})`}
            value={draft.overrides[claim.id] ?? ""}
            error={errors[`overrides.${claim.id}`]}
            onChange={(text) => patch({ overrides: { ...draft.overrides, [claim.id]: text } })}
          />
        ) : null}
      </li>
    );
  }

  const editor = (
    <form noValidate onSubmit={save} className="flex flex-col gap-6">
      {errors[""] ? <Alert tone="error" title="Resume not saved">{errors[""]}</Alert> : null}
      <Panel title="Target role">
        <div className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Target role" required error={errors.targetRole}>
              <Input value={draft.targetRole} maxLength={100} onChange={(event) => patch({ targetRole: event.target.value })} />
            </Field>
            <Field label="Resume name" required error={errors.name}>
              <Input value={draft.name} maxLength={100} onChange={(event) => patch({ name: event.target.value })} />
            </Field>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <Field
              label="Keywords"
              hint="Optional. For example, technologies from a job posting. Used only to match your approved content."
              className="sm:flex-1"
            >
              <Input value={keywords} onChange={(event) => setKeywords(event.target.value)} />
            </Field>
            <Button variant="secondary" onClick={suggest} disabled={draft.targetRole.trim() === ""} className="sm:mb-7">
              <Wand2 aria-hidden="true" size={16} strokeWidth={1.75} />
              Suggest selections
            </Button>
          </div>
          <p role="status" className="text-support text-foreground-secondary empty:hidden">
            {announcement}
          </p>
          <p className="text-support text-muted">
            Suggestions only pre-select approved items by keyword overlap. They never add or change text.
          </p>
        </div>
      </Panel>

      <Panel title="Summary" description="Your own words for this role. Updater doesn't generate summaries.">
        <div className="flex flex-col gap-3">
          <Field label="Summary" error={errors.summary} hint={`${draft.summary.length}/1200 characters`}>
            <Textarea value={draft.summary} rows={5} maxLength={1200} onChange={(event) => patch({ summary: event.target.value })} />
          </Field>
          <div>
            <Button
              variant="secondary"
              size="sm"
              disabled={!ws.profile?.intro}
              onClick={() => {
                const intro = ws.profile?.intro ?? "";
                patch({ summary: draft.summary ? `${draft.summary}\n\n${intro}` : intro });
              }}
            >
              Insert portfolio introduction
            </Button>
            {!ws.profile?.intro ? (
              <p className="mt-1 text-support text-muted">Add an introduction in the Portfolio editor to use this.</p>
            ) : null}
          </div>
        </div>
      </Panel>

      {!ws.profile?.name ? (
        <Alert tone="warning" title="Your name is missing">
          The resume has no name until you add one in the{" "}
          <Link href="/portfolio" className="text-link underline underline-offset-4">Portfolio editor</Link>.
        </Alert>
      ) : null}
      {pending > 0 ? (
        <Alert tone="info" title={`${plural(pending, "item is", "items are")} still in the Review Queue`}>
          Only approved content can be selected. <Link href="/review" className="text-link underline underline-offset-4">Open the Review Queue</Link>.
        </Alert>
      ) : null}

      <Panel title="Projects" description="Approved projects and projects you added to the portfolio.">
        {projects.length === 0 ? (
          <p className="text-body text-foreground-secondary">No projects in your portfolio yet.</p>
        ) : (
          <div className="flex flex-col gap-4">
            <ul className="flex flex-col gap-3">
              {projects.map((project) => (
                <li key={project.id}>
                  <Checkbox
                    label={project.name}
                    hint={
                      <span className="flex flex-wrap items-center gap-2">
                        {projectSummary(ws, project).text || "No summary."}
                        {project.isDemo ? <DemoBadge /> : null}
                        {!project.visible ? <span>(hidden in portfolio)</span> : null}
                      </span>
                    }
                    checked={draft.projectIds.includes(project.id)}
                    onCheckedChange={(value) => patch({ projectIds: toggle(draft.projectIds, project.id, value === true) })}
                  />
                </li>
              ))}
            </ul>
            {draft.projectIds.length > 1 ? (
              <div className="flex flex-col gap-2 border-t border-border pt-4">
                <h3 className="text-label font-semibold">Order in this resume</h3>
                <ol className="flex flex-col gap-1">
                  {draft.projectIds.map((id, index) => {
                    const project = projects.find((candidate) => candidate.id === id);
                    if (!project) return null;
                    return (
                      <li key={id} className="flex items-center justify-between gap-2 text-body">
                        <span className="min-w-0 break-words">
                          {index + 1}. {project.name}
                        </span>
                        <span className="flex gap-1">
                          <Button variant="ghost" size="icon-sm" aria-label={`Move ${project.name} up`} disabled={index === 0} onClick={() => moveProject(id, -1)}>
                            <ArrowUp aria-hidden="true" size={16} strokeWidth={1.75} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Move ${project.name} down`}
                            disabled={index === draft.projectIds.length - 1}
                            onClick={() => moveProject(id, 1)}
                          >
                            <ArrowDown aria-hidden="true" size={16} strokeWidth={1.75} />
                          </Button>
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </div>
            ) : null}
            {draft.projectIds.map((id) => {
              const project = projects.find((candidate) => candidate.id === id);
              const summaryClaim = project ? projectSummary(ws, project).claim : undefined;
              if (!project || !summaryClaim) return null;
              return (
                <OverrideField
                  key={id}
                  claim={summaryClaim}
                  label={`${project.name}: summary wording for this resume only`}
                  value={draft.overrides[summaryClaim.id] ?? ""}
                  error={errors[`overrides.${summaryClaim.id}`]}
                  onChange={(text) => patch({ overrides: { ...draft.overrides, [summaryClaim.id]: text } })}
                />
              );
            })}
          </div>
        )}
      </Panel>

      <Panel title="Achievements" description="Approved achievements, grouped by project.">
        {projects.every((project) => projectClaims(ws, project).length === 0) && other.length === 0 ? (
          <p className="text-body text-foreground-secondary">No approved achievements yet.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {projects.map((project) => {
              const claims = projectClaims(ws, project);
              if (claims.length === 0) return null;
              return (
                <fieldset key={project.id} className="flex flex-col">
                  <legend className="text-label font-semibold">{project.name}</legend>
                  <ul className="flex flex-col divide-y divide-border">{claims.map(claimOption)}</ul>
                </fieldset>
              );
            })}
            {other.length > 0 ? (
              <fieldset className="flex flex-col">
                <legend className="text-label font-semibold">Not attached to a project</legend>
                <ul className="flex flex-col divide-y divide-border">{other.map(claimOption)}</ul>
              </fieldset>
            ) : null}
          </div>
        )}
      </Panel>

      <Panel title="Skills">
        {skills.length === 0 ? (
          <p className="text-body text-foreground-secondary">No skills in your portfolio yet.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {skills.map((skill) => (
              <li key={skill.id}>
                <Checkbox
                  label={skill.name}
                  hint={`${skill.origin === "source" ? "From source" : "User-supplied"}${skill.isDemo ? " · Demo data" : ""}`}
                  checked={draft.skillIds.includes(skill.id)}
                  onCheckedChange={(value) => patch({ skillIds: toggle(draft.skillIds, skill.id, value === true) })}
                />
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Contact">
        <Switch
          label="Include contact details"
          hint={
            ws.profile?.email || (ws.profile?.links.length ?? 0) > 0
              ? "Adds your email, location, and profile links from the Portfolio editor."
              : "Your profile has no email or links yet. Add them in the Portfolio editor."
          }
          checked={draft.includeContact}
          onCheckedChange={(value) => patch({ includeContact: value })}
          className="max-w-md"
        />
      </Panel>
    </form>
  );

  const preview = (
    <section aria-labelledby="resume-preview-heading" className="rounded-md border border-border bg-surface">
      <div className="border-b border-border bg-surface-muted px-4 py-3 sm:px-5">
        <h2 id="resume-preview-heading" className="text-label font-semibold">
          Resume preview
        </h2>
        <p className="text-support text-muted">
          {dirty ? "Shows your current edits, including unsaved changes." : "Shows the saved draft."} Print uses this view.
        </p>
      </div>
      <div className="px-4 py-6 sm:px-6">
        <ResumeDocumentView doc={doc} headingLevel={2} />
      </div>
    </section>
  );

  return (
    <>
      <div className="flex flex-col gap-6 print:hidden">
        <div className="flex flex-col gap-3 rounded-md border border-border bg-surface px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="flex min-w-0 flex-col gap-1">
            <Link href="/resumes" className="inline-flex items-center gap-1 text-support text-link underline-offset-4 hover:underline">
              <ArrowLeft aria-hidden="true" size={14} strokeWidth={1.75} />
              All resumes
            </Link>
            <h2 className="text-heading font-semibold break-words">{resume.name}</h2>
            <p className="flex flex-wrap items-center gap-2 text-meta font-medium text-muted">
              <span>
                Saved <time dateTime={resume.updatedAt}>{formatDateTime(resume.updatedAt)}</time>
              </span>
              <UnsavedNote dirty={dirty} />
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="primary" disabled={!dirty} onClick={() => save()}>
              Save draft
            </Button>
            <Button variant="secondary" onClick={() => window.print()}>
              <Printer aria-hidden="true" size={16} strokeWidth={1.75} />
              Print / Save as PDF
            </Button>
          </div>
        </div>
        <p className="text-support text-muted">
          “Print / Save as PDF” opens your browser&apos;s print dialog. Updater doesn&apos;t generate PDF files and
          doesn&apos;t check compatibility with applicant tracking systems.
        </p>
        {wide ? (
          <div className="grid grid-cols-[minmax(0,11fr)_minmax(0,9fr)] items-start gap-6">
            {editor}
            <div className="sticky top-20 max-h-[calc(100dvh-6rem)] overflow-y-auto">{preview}</div>
          </div>
        ) : (
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList aria-label="Resume views">
              <TabsTrigger value="edit">Edit</TabsTrigger>
              <TabsTrigger value="preview">Preview</TabsTrigger>
            </TabsList>
            <TabsContent value="edit">{editor}</TabsContent>
            <TabsContent value="preview">{preview}</TabsContent>
          </Tabs>
        )}
      </div>
      {/* Print-only copy, so printing works from either tab (design.md §12). */}
      <div className="resume-print hidden print:block">
        <ResumeDocumentView doc={doc} headingLevel={1} />
      </div>
    </>
  );
}

function OverrideField({
  claim,
  label,
  value,
  error,
  onChange,
}: {
  claim: PortfolioClaim;
  label: string;
  value: string;
  error?: string;
  onChange: (text: string) => void;
}) {
  return (
    <Field
      label={label}
      error={error}
      hint={`Optional. Leave empty to use the portfolio wording. This never changes the ${claim.origin === "user" ? "achievement" : "approved claim or its evidence"}.`}
      className="sm:pl-7"
    >
      <Textarea value={value} rows={2} maxLength={500} placeholder={claim.text} onChange={(event) => onChange(event.target.value)} />
    </Field>
  );
}
