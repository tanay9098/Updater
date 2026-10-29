"use client";

import { useState, type FormEvent } from "react";
import { PenLine, Plus, Trash2 } from "lucide-react";
import { addClaim, removeClaim, updateClaimText } from "@/features/portfolio/portfolio";
import type { PortfolioClaim, Workspace } from "@/types/domain";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { DemoBadge, OriginBadge } from "@/components/workspace/badges";
import { useWorkspaceAction } from "@/components/workspace/workspace-provider";
import { EvidenceDialog } from "./evidence-dialog";

/**
 * An approved achievement in the editor: origin badge, evidence, inline
 * edit, and remove (design.md §11, FR-EDIT-05).
 */
export function ClaimRow({ claim, ws }: { claim: PortfolioClaim; ws: Workspace }) {
  const run = useWorkspaceAction();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(claim.text);
  const [error, setError] = useState<string | undefined>();
  const label = claim.text.length > 50 ? `${claim.text.slice(0, 49)}…` : claim.text;

  function save(event: FormEvent) {
    event.preventDefault();
    const outcome = run((current, now) => updateClaimText(current, claim.id, text, now), {
      success: {
        title: "Achievement saved",
        ...(claim.origin === "source" ? { description: "Marked Edited from source. Evidence links are kept." } : {}),
      },
    });
    if (outcome.ok || outcome.applied) {
      setEditing(false);
      setError(undefined);
    } else {
      setError(outcome.fieldErrors?.text ?? outcome.error.message);
    }
  }

  return (
    <li className="flex flex-col gap-2 py-3">
      {editing ? (
        <form noValidate onSubmit={save} className="flex flex-col gap-2">
          <Field
            label="Achievement"
            required
            error={error}
            hint={claim.origin === "source" ? "Will be marked Edited from source. Evidence links are kept." : undefined}
          >
            <Textarea value={text} rows={3} maxLength={500} onChange={(event) => setText(event.target.value)} autoFocus />
          </Field>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="submit" variant="primary" size="sm">
              Save achievement
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setEditing(false);
                setText(claim.text);
                setError(undefined);
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <p className="text-body break-words">{claim.text}</p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <OriginBadge origin={claim.origin} />
        {claim.isDemo ? <DemoBadge /> : null}
        {claim.sourceRemoved ? <span className="text-meta font-medium text-muted">Source removed</span> : null}
        <EvidenceDialog ws={ws} evidenceIds={claim.evidenceIds} subject={label} sourceRemoved={claim.sourceRemoved} />
        {!editing ? (
          <Button
            variant="ghost"
            size="sm"
            aria-label={`Edit “${label}”`}
            onClick={() => {
              setText(claim.text);
              setEditing(true);
            }}
          >
            <PenLine aria-hidden="true" size={16} strokeWidth={1.75} />
            Edit
          </Button>
        ) : null}
        <ConfirmDialog
          trigger={
            <Button variant="ghost" size="sm" aria-label={`Remove “${label}”`}>
              <Trash2 aria-hidden="true" size={16} strokeWidth={1.75} />
              Remove
            </Button>
          }
          title="Remove this achievement?"
          description={`“${label}” is removed from the portfolio and from any resume that selected it. Its evidence stays under Sources.`}
          confirmLabel="Remove achievement"
          destructive
          onConfirm={() => {
            const outcome = run((current, now) => removeClaim(current, claim.id, now), {
              success: { title: "Achievement removed" },
            });
            if (!outcome.ok && !outcome.applied) throw new Error(outcome.error.message);
          }}
        />
      </div>
    </li>
  );
}

/** Adds a user-written achievement (origin `user`). */
export function AddClaimForm({ projectId, projectName }: { projectId?: string; projectName?: string }) {
  const run = useWorkspaceAction();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | undefined>();

  if (!open) {
    return (
      <div>
        <Button
          variant="secondary"
          size="sm"
          aria-label={projectName ? `Add achievement to ${projectName}` : "Add achievement"}
          onClick={() => setOpen(true)}
        >
          <Plus aria-hidden="true" size={16} strokeWidth={1.75} />
          Add achievement
        </Button>
      </div>
    );
  }

  return (
    <form
      noValidate
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const outcome = run((current, now) => addClaim(current, projectId, text, now), {
          success: { title: "Achievement added", description: "Labeled User-supplied." },
        });
        if (outcome.ok || outcome.applied) {
          setText("");
          setError(undefined);
          setOpen(false);
        } else {
          setError(outcome.fieldErrors?.text ?? outcome.error.message);
        }
      }}
    >
      <Field
        label={projectName ? `New achievement for ${projectName}` : "New achievement"}
        required
        error={error}
        hint="Your own statement. It is labeled User-supplied and has no linked evidence."
      >
        <Textarea value={text} rows={3} maxLength={500} onChange={(event) => setText(event.target.value)} autoFocus />
      </Field>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="submit" variant="primary" size="sm">
          Add achievement
        </Button>
        <Button variant="secondary" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
