"use client";

import { useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { addSkill, removeSkill } from "@/features/portfolio/portfolio";
import type { Workspace } from "@/types/domain";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Panel } from "@/components/ui/panel";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils/cn";
import { useWorkspaceAction } from "@/components/workspace/workspace-provider";
import { EvidenceDialog } from "./evidence-dialog";

/** Skills as chips with an origin indicator (design.md §11). Add and remove save immediately. */
export function SkillsSection({ ws }: { ws: Workspace }) {
  const run = useWorkspaceAction();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | undefined>();
  const skills = ws.portfolio.skills;

  function submit(event: FormEvent) {
    event.preventDefault();
    const outcome = run((current, now) => addSkill(current, name, now), {
      success: (value) => ({ title: `Added “${value.workspace.portfolio.skills.at(-1)?.name ?? name.trim()}”` }),
    });
    if (outcome.ok || outcome.applied) {
      setName("");
      setError(undefined);
    } else {
      setError(outcome.fieldErrors?.name ?? outcome.error.message);
    }
  }

  return (
    <Panel title="Skills" description="Skills you add are User-supplied. Approved skill proposals keep their evidence.">
      {skills.length === 0 ? (
        <p className="mb-4 text-body text-foreground-secondary">No skills yet.</p>
      ) : (
        <ul className="mb-4 flex flex-wrap gap-2">
          {skills.map((skill) => {
            const originLabel = skill.origin === "source" ? "From source" : "User-supplied";
            return (
              <li
                key={skill.id}
                className="inline-flex max-w-full flex-wrap items-center gap-1 rounded-sm border border-border bg-surface-muted py-0.5 pr-0.5 pl-2 text-label"
              >
                <Tooltip content={originLabel}>
                  <span
                    aria-hidden="true"
                    className={cn("size-2 rounded-full", skill.origin === "source" ? "bg-info" : "bg-muted")}
                  />
                </Tooltip>
                <span className="font-medium">{skill.name}</span>
                <span className="sr-only">({originLabel}{skill.isDemo ? ", demo data" : ""})</span>
                {skill.isDemo ? <span className="text-meta font-medium text-demo" aria-hidden="true">Demo</span> : null}
                {skill.evidenceIds.length > 0 ? (
                  <EvidenceDialog ws={ws} evidenceIds={skill.evidenceIds} subject={skill.name} />
                ) : null}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove ${skill.name}`}
                  onClick={() => run((current, now) => removeSkill(current, skill.id, now), { success: { title: `Removed “${skill.name}”` }, announceRefusal: true })}
                >
                  <X aria-hidden="true" size={16} strokeWidth={1.75} />
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      <form noValidate onSubmit={submit} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <Field label="Add a skill" error={error} className="sm:max-w-xs sm:flex-1">
          <Input value={name} maxLength={40} onChange={(event) => setName(event.target.value)} />
        </Field>
        <Button type="submit" variant="secondary" className={error ? "sm:mb-7" : undefined}>
          Add skill
        </Button>
      </form>
    </Panel>
  );
}
