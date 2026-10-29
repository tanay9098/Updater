"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { MANUAL_ENTRY_KINDS } from "@/lib/validation/domain";
import type { FieldErrors } from "@/lib/validation/field-errors";
import { addManualItem } from "@/features/sources/manual";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useWorkspace, useWorkspaceAction } from "@/components/workspace/workspace-provider";

type Kind = (typeof MANUAL_ENTRY_KINDS)[number];

const KIND_OPTIONS: Record<Kind, string> = {
  project: "Project",
  article: "Article or talk",
  contribution: "Contribution",
  achievement: "Achievement",
};

const EMPTY = { kind: "project" as Kind, title: "", url: "", occurredAt: "", description: "", technologies: "", targetProjectId: "" };

/**
 * Manual entry (design.md §9, FR-SRC-04). Creates a source item, a
 * user-supplied statement, and a proposal in the Review Queue.
 */
export function ManualEntryDialog({ triggerLabel = "Add entry" }: { triggerLabel?: string }) {
  const ws = useWorkspace();
  const run = useWorkspaceAction();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  function update<K extends keyof typeof EMPTY>(key: K, value: (typeof EMPTY)[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setValues(EMPTY);
      setErrors({});
      setFormError(null);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const input = { ...values, targetProjectId: values.kind === "project" ? "" : values.targetProjectId };
    const outcome = run((current, now) => addManualItem(current, input, now), {
      success: {
        title: "Entry added",
        description: "Recorded as a user-supplied statement. A proposal is waiting in the Review Queue.",
      },
    });
    if (outcome.ok || outcome.applied) {
      setOpen(false);
      return;
    }
    setErrors(outcome.fieldErrors ?? (outcome.error.field ? { [outcome.error.field]: outcome.error.message } : {}));
    setFormError(outcome.fieldErrors ? null : outcome.error.message);
  }

  const errorCount = Object.keys(errors).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="primary" size="sm">
          <Plus aria-hidden="true" size={16} strokeWidth={1.75} />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent
        title="Add a manual entry"
        description="This is recorded as a user-supplied statement, not externally verified."
      >
        <form noValidate onSubmit={submit} className="flex flex-col gap-4">
          {errorCount > 1 ? (
            <Alert tone="error" title={`${errorCount} fields need attention`}>
              Fix the fields marked below, then add the entry again.
            </Alert>
          ) : null}
          {formError ? <Alert tone="error" title="The entry wasn't added">{formError}</Alert> : null}
          <Field label="Kind" required>
            <Select value={values.kind} onChange={(event) => update("kind", event.target.value as Kind)}>
              {MANUAL_ENTRY_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {KIND_OPTIONS[kind]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Title" required error={errors.title}>
            <Input value={values.title} maxLength={140} onChange={(event) => update("title", event.target.value)} />
          </Field>
          <Field
            label="Description"
            required
            error={errors.description}
            hint="Your own words. Becomes the proposed text, which you can still edit before approving."
          >
            <Textarea
              value={values.description}
              maxLength={1000}
              onChange={(event) => update("description", event.target.value)}
            />
          </Field>
          <Field label="Link" error={errors.url} hint="Optional. A full address starting with https://.">
            <Input type="url" inputMode="url" value={values.url} onChange={(event) => update("url", event.target.value)} />
          </Field>
          <Field label="Date" error={errors.occurredAt} hint="Optional. When it was published, merged, or completed.">
            <Input type="date" value={values.occurredAt} onChange={(event) => update("occurredAt", event.target.value)} />
          </Field>
          {values.kind === "project" ? (
            <Field label="Technologies" error={errors.technologies} hint="Optional. Separate with commas.">
              <Input value={values.technologies} onChange={(event) => update("technologies", event.target.value)} />
            </Field>
          ) : (
            <Field
              label="Portfolio project"
              error={errors.targetProjectId}
              hint={
                ws.portfolio.projects.length === 0 ? (
                  <>
                    No projects yet. The achievement will be listed on its own. Projects appear after you approve or{" "}
                    <Link href="/portfolio" className="text-link underline underline-offset-4">add one</Link>.
                  </>
                ) : (
                  "Optional. Lists the achievement under this project once approved."
                )
              }
            >
              <Select
                value={values.targetProjectId}
                disabled={ws.portfolio.projects.length === 0}
                onChange={(event) => update("targetProjectId", event.target.value)}
              >
                <option value="">No project</option>
                {ws.portfolio.projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <DialogFooter>
            <Button type="submit" variant="primary">
              Add entry
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
