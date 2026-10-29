"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, Pencil, Plus, Trash2 } from "lucide-react";
import { formatDateTime } from "@/lib/utils/dates";
import type { FieldErrors } from "@/lib/validation/field-errors";
import { createResume, deleteResume, duplicateResume, renameResume } from "@/features/resumes/drafts";
import type { ResumeDraft } from "@/types/domain";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useWorkspace, useWorkspaceAction } from "@/components/workspace/workspace-provider";

/** Resume drafts (design.md §12, FR-RES-01). */
export function ResumeList() {
  const ws = useWorkspace();
  const approvedCount = ws.portfolio.projects.length + ws.portfolio.claims.length + ws.portfolio.skills.length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-prose text-body text-foreground-secondary">
          Each resume is a selection of your approved portfolio content for one target role. Updater doesn&apos;t
          write or embellish resume text.
        </p>
        <NewResumeDialog />
      </div>
      {approvedCount === 0 ? (
        <p className="text-support text-muted">
          Your portfolio has no approved content yet, so a new resume can only hold a summary you write. Approve
          proposals in the Review Queue first.
        </p>
      ) : null}
      {ws.resumes.length === 0 ? (
        <EmptyState
          title="No resume drafts"
          description="Create one for a target role, such as “Backend Engineer”. You choose which approved projects, achievements, and skills it includes."
        />
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-md border border-border bg-surface">
          {ws.resumes.map((resume) => (
            <ResumeRow key={resume.id} resume={resume} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ResumeRow({ resume }: { resume: ResumeDraft }) {
  const run = useWorkspaceAction();
  const selections = resume.projectIds.length + resume.claimIds.length + resume.skillIds.length;
  return (
    <li className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <div className="flex min-w-0 flex-col gap-0.5">
        <Link href={`/resumes/${resume.id}`} className="text-subheading font-semibold break-words text-link underline-offset-4 hover:underline">
          {resume.name}
        </Link>
        <p className="text-support text-foreground-secondary">Target role: {resume.targetRole}</p>
        <p className="text-meta font-medium text-muted">
          {selections} {selections === 1 ? "selection" : "selections"} · Saved{" "}
          <time dateTime={resume.updatedAt}>{formatDateTime(resume.updatedAt)}</time>
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="primary" size="sm">
          <Link href={`/resumes/${resume.id}`} aria-label={`Open ${resume.name}`}>
            Open
          </Link>
        </Button>
        <RenameDialog resume={resume} />
        <Button
          variant="secondary"
          size="sm"
          aria-label={`Duplicate ${resume.name}`}
          onClick={() =>
            run((ws, now) => duplicateResume(ws, resume.id, now), {
              success: { title: "Resume duplicated" },
              announceRefusal: true,
            })
          }
        >
          <Copy aria-hidden="true" size={16} strokeWidth={1.75} />
          Duplicate
        </Button>
        <ConfirmDialog
          trigger={
            <Button variant="secondary" size="sm" aria-label={`Delete ${resume.name}`}>
              <Trash2 aria-hidden="true" size={16} strokeWidth={1.75} />
              Delete
            </Button>
          }
          title={`Delete “${resume.name}”?`}
          description="This deletes the resume draft: its summary, selections, and per-resume wording. Your portfolio and its evidence are not affected."
          confirmLabel="Delete resume"
          destructive
          onConfirm={() => {
            const outcome = run((ws, now) => deleteResume(ws, resume.id, now), { success: { title: "Resume deleted" } });
            if (!outcome.ok && !outcome.applied) throw new Error(outcome.error.message);
          }}
        />
      </div>
    </li>
  );
}

function NewResumeDialog() {
  const run = useWorkspaceAction();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState({ targetRole: "", name: "" });
  const [errors, setErrors] = useState<FieldErrors>({});

  function submit(event: FormEvent) {
    event.preventDefault();
    const outcome = run((ws, now) => createResume(ws, values, now), { success: { title: "Resume created" } });
    if (outcome.ok || outcome.applied) {
      setOpen(false);
      router.push(`/resumes/${outcome.value.resumeId}`);
    } else {
      setErrors(outcome.fieldErrors ?? { targetRole: outcome.error.message });
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setValues({ targetRole: "", name: "" });
          setErrors({});
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="primary">
          <Plus aria-hidden="true" size={16} strokeWidth={1.75} />
          New resume
        </Button>
      </DialogTrigger>
      <DialogContent title="New resume" description="Start a draft for one target role.">
        <form noValidate onSubmit={submit} className="flex flex-col gap-4">
          <Field label="Target role" required error={errors.targetRole} hint="For example, Backend Engineer.">
            <Input value={values.targetRole} maxLength={100} onChange={(event) => setValues({ ...values, targetRole: event.target.value })} />
          </Field>
          <Field label="Resume name" error={errors.name} hint="Optional. Defaults to the target role.">
            <Input value={values.name} maxLength={100} onChange={(event) => setValues({ ...values, name: event.target.value })} />
          </Field>
          <DialogFooter>
            <Button type="submit" variant="primary">
              Create resume
            </Button>
            <DialogClose asChild>
              <Button variant="secondary">Cancel</Button>
            </DialogClose>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RenameDialog({ resume }: { resume: ResumeDraft }) {
  const run = useWorkspaceAction();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(resume.name);
  const [error, setError] = useState<string | undefined>();

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setName(resume.name);
          setError(undefined);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm" aria-label={`Rename ${resume.name}`}>
          <Pencil aria-hidden="true" size={16} strokeWidth={1.75} />
          Rename
        </Button>
      </DialogTrigger>
      <DialogContent title="Rename resume">
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            const outcome = run((ws, now) => renameResume(ws, resume.id, name, now), { success: { title: "Resume renamed" } });
            if (outcome.ok || outcome.applied) setOpen(false);
            else setError(outcome.fieldErrors?.name ?? outcome.error.message);
          }}
        >
          <Field label="Resume name" required error={error}>
            <Input value={name} maxLength={100} onChange={(event) => setName(event.target.value)} />
          </Field>
          <DialogFooter>
            <Button type="submit" variant="primary">
              Save name
            </Button>
            <DialogClose asChild>
              <Button variant="secondary">Cancel</Button>
            </DialogClose>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
