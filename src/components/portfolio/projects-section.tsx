"use client";

import { useId, useState, type FormEvent } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import {
  addProject,
  deleteProject,
  moveProject,
  projectClaims,
  projectSummary,
  setProjectVisibility,
  standaloneClaims,
  updateProject,
} from "@/features/portfolio/portfolio";
import type { FieldErrors } from "@/lib/validation/field-errors";
import type { PortfolioProject, Workspace } from "@/types/domain";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Panel } from "@/components/ui/panel";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useUnsavedWarning } from "@/components/hooks/use-unsaved-warning";
import { DemoBadge, OriginBadge } from "@/components/workspace/badges";
import { useWorkspaceAction } from "@/components/workspace/workspace-provider";
import { AddClaimForm, ClaimRow } from "./claim-row";
import { EvidenceDialog } from "./evidence-dialog";
import { LinkListEditor, linkErrors, newLinkRow, sameLinks, type LinkRow } from "./link-list-editor";
import { UnsavedNote } from "./profile-section";

/** Projects: add, edit, reorder, hide, delete (FR-PORT-02), with achievements under each. */
export function ProjectsSection({ ws }: { ws: Workspace }) {
  const projects = ws.portfolio.projects;
  return (
    <Panel
      title="Projects"
      description="Approved project proposals and projects you add. Hidden projects stay in the draft but not in the preview."
    >
      <div className="flex flex-col gap-6">
        {projects.length === 0 ? (
          <p className="text-body text-foreground-secondary">
            No projects yet. Approve a project proposal in the Review Queue, or add one below.
          </p>
        ) : (
          <ol className="flex flex-col divide-y divide-border">
            {projects.map((project, index) => (
              <li key={project.id} className="py-4 first:pt-0">
                <ProjectEditor ws={ws} project={project} index={index} total={projects.length} />
              </li>
            ))}
          </ol>
        )}
        <AddProjectForm />
      </div>
    </Panel>
  );
}

function ProjectEditor({
  ws,
  project,
  index,
  total,
}: {
  ws: Workspace;
  project: PortfolioProject;
  index: number;
  total: number;
}) {
  const run = useWorkspaceAction();
  const headingId = useId();
  const summary = projectSummary(ws, project);
  const claims = projectClaims(ws, project);
  const signature = JSON.stringify([project.name, summary.text, project.technologies, project.links]);

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h3 id={headingId} className="text-subheading font-semibold break-words">
            {project.name}
          </h3>
          {project.isDemo ? <DemoBadge /> : null}
          {project.sourceRemoved ? <span className="text-meta font-medium text-muted">Source removed</span> : null}
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Move ${project.name} up`}
            disabled={index === 0}
            onClick={() => run((current, now) => moveProject(current, project.id, "up", now), { announceRefusal: true })}
          >
            <ArrowUp aria-hidden="true" size={16} strokeWidth={1.75} />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Move ${project.name} down`}
            disabled={index === total - 1}
            onClick={() => run((current, now) => moveProject(current, project.id, "down", now), { announceRefusal: true })}
          >
            <ArrowDown aria-hidden="true" size={16} strokeWidth={1.75} />
          </Button>
          <ConfirmDialog
            trigger={
              <Button variant="ghost" size="sm" aria-label={`Delete ${project.name}`}>
                <Trash2 aria-hidden="true" size={16} strokeWidth={1.75} />
                Delete
              </Button>
            }
            title={`Delete “${project.name}”?`}
            description={`The project and its ${claims.length + (summary.claim ? 1 : 0)} approved ${
              claims.length + (summary.claim ? 1 : 0) === 1 ? "achievement" : "achievements"
            } are removed from the portfolio and from any resume. Evidence and source items stay under Sources; the review history stays in the Review Queue.`}
            confirmLabel="Delete project"
            destructive
            onConfirm={() => {
              const outcome = run((current, now) => deleteProject(current, project.id, now), {
                success: { title: "Project deleted" },
              });
              if (!outcome.ok && !outcome.applied) throw new Error(outcome.error.message);
            }}
          />
        </div>
      </div>

      <Switch
        label="Shown in portfolio"
        hint={project.visible ? "Visible in the local preview." : "Hidden from the preview. It stays in your draft."}
        checked={project.visible}
        onCheckedChange={(visible) =>
          run((current, now) => setProjectVisibility(current, project.id, visible, now), {
            success: { title: visible ? "Project shown" : "Project hidden" },
          })
        }
        className="max-w-md"
      />

      <ProjectForm key={signature} ws={ws} project={project} />

      <div className="flex flex-col gap-2">
        <h4 className="text-label font-semibold">Achievements</h4>
        {claims.length === 0 ? (
          <p className="text-support text-muted">No achievements under this project.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {claims.map((claim) => (
              <ClaimRow key={claim.id} claim={claim} ws={ws} />
            ))}
          </ul>
        )}
        <AddClaimForm projectId={project.id} projectName={project.name} />
      </div>
    </section>
  );
}

function ProjectForm({ ws, project }: { ws: Workspace; project: PortfolioProject }) {
  const run = useWorkspaceAction();
  const summary = projectSummary(ws, project);
  const saved = { name: project.name, summary: summary.text, technologies: project.technologies.join(", ") };
  const [values, setValues] = useState(saved);
  const [links, setLinks] = useState<LinkRow[]>(() => project.links.map((link) => newLinkRow(link)));
  const [errors, setErrors] = useState<FieldErrors>({});
  const dirty =
    values.name !== saved.name ||
    values.summary !== saved.summary ||
    values.technologies !== saved.technologies ||
    !sameLinks(links, project.links);
  useUnsavedWarning(dirty);

  function submit(event: FormEvent) {
    event.preventDefault();
    const outcome = run((current, now) => updateProject(current, project.id, { ...values, links }, now), {
      success: { title: "Project saved" },
    });
    if (outcome.ok || outcome.applied) setErrors({});
    else setErrors(outcome.fieldErrors ?? (outcome.error.field ? { [outcome.error.field]: outcome.error.message } : { "": outcome.error.message }));
  }

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-4">
      {errors[""] ? <Alert tone="error" title="Project not saved">{errors[""]}</Alert> : null}
      <Field label="Project name" required error={errors.name}>
        <Input value={values.name} maxLength={100} onChange={(event) => setValues({ ...values, name: event.target.value })} />
      </Field>
      <Field
        label="Summary"
        error={errors.summary}
        hint={
          summary.claim
            ? summary.claim.origin === "source"
              ? "From an approved proposal. Editing marks it Edited from source; evidence links are kept."
              : "From an approved proposal."
            : `${values.summary.length}/500. Your own wording.`
        }
      >
        <Textarea
          value={values.summary}
          rows={3}
          maxLength={500}
          onChange={(event) => setValues({ ...values, summary: event.target.value })}
        />
      </Field>
      {summary.claim ? (
        <div className="-mt-2 flex flex-wrap items-center gap-2">
          <OriginBadge origin={summary.claim.origin} />
          <EvidenceDialog
            ws={ws}
            evidenceIds={summary.claim.evidenceIds}
            subject={`${project.name} summary`}
            sourceRemoved={summary.claim.sourceRemoved}
          />
        </div>
      ) : null}
      <Field label="Technologies" error={errors.technologies} hint="Separate with commas.">
        <Input value={values.technologies} onChange={(event) => setValues({ ...values, technologies: event.target.value })} />
      </Field>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-label font-medium">Project links</legend>
        <LinkListEditor
          rows={links}
          onChange={setLinks}
          errors={linkErrors(errors, "links.")}
          max={10}
          addLabel={`Add link to ${project.name}`}
        />
      </fieldset>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="primary" disabled={!dirty}>
          Save project
        </Button>
        <UnsavedNote dirty={dirty} />
      </div>
    </form>
  );
}

function AddProjectForm() {
  const run = useWorkspaceAction();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState({ name: "", summary: "", technologies: "" });
  const [errors, setErrors] = useState<FieldErrors>({});

  if (!open) {
    return (
      <div>
        <Button variant="secondary" onClick={() => setOpen(true)}>
          <Plus aria-hidden="true" size={16} strokeWidth={1.75} />
          Add project
        </Button>
      </div>
    );
  }

  return (
    <form
      noValidate
      className="flex flex-col gap-4 border-t border-border pt-4"
      onSubmit={(event) => {
        event.preventDefault();
        const outcome = run((current, now) => addProject(current, values, now), {
          success: { title: "Project added", description: "Its summary is labeled as your own wording." },
        });
        if (outcome.ok || outcome.applied) {
          setValues({ name: "", summary: "", technologies: "" });
          setErrors({});
          setOpen(false);
        } else {
          setErrors(outcome.fieldErrors ?? {});
        }
      }}
    >
      <h3 className="text-subheading font-semibold">New project</h3>
      <Field label="Project name" required error={errors.name}>
        <Input value={values.name} maxLength={100} onChange={(event) => setValues({ ...values, name: event.target.value })} autoFocus />
      </Field>
      <Field label="Summary" error={errors.summary} hint="Optional. Your own wording.">
        <Textarea value={values.summary} rows={3} maxLength={500} onChange={(event) => setValues({ ...values, summary: event.target.value })} />
      </Field>
      <Field label="Technologies" error={errors.technologies} hint="Optional. Separate with commas.">
        <Input value={values.technologies} onChange={(event) => setValues({ ...values, technologies: event.target.value })} />
      </Field>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="submit" variant="primary">
          Add project
        </Button>
        <Button variant="secondary" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/** Approved achievements that belong to no project (for example articles). */
export function OtherAchievementsSection({ ws }: { ws: Workspace }) {
  const claims = standaloneClaims(ws);
  return (
    <Panel title="Other achievements" description="Approved achievements that aren't attached to a project, such as articles.">
      <div className="flex flex-col gap-3">
        {claims.length === 0 ? (
          <p className="text-body text-foreground-secondary">None yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {claims.map((claim) => (
              <ClaimRow key={claim.id} claim={claim} ws={ws} />
            ))}
          </ul>
        )}
        <AddClaimForm />
      </div>
    </Panel>
  );
}
