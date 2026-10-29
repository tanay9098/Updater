"use client";

import { useId, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, ChevronRight, PenLine, RotateCcw, Undo2, X } from "lucide-react";
import { formatDate } from "@/lib/utils/dates";
import {
  approveReviewItem,
  canPerform,
  dismissReviewItem,
  editReviewItem,
  hasConflictingEvidence,
  restoreReviewItem,
  revertReviewEdit,
} from "@/features/review/transitions";
import { currentReviewText, findEvidence, provenanceOf } from "@/features/workspace/workspace";
import type { ReviewItem as ReviewItemModel, Workspace } from "@/types/domain";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogClose, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  DemoBadge,
  ReviewStatusBadge,
  VerificationBadge,
  WordingLabel,
  verificationDescription,
} from "@/components/workspace/badges";
import { ExternalLink } from "@/components/workspace/external-link";
import { useWorkspaceAction } from "@/components/workspace/workspace-provider";
import { ITEM_KIND_LABELS, KIND_LABELS } from "./labels";

type Props = {
  item: ReviewItemModel;
  ws: Workspace;
  /** Called after an action moved the item out of the current tab. */
  onLeftList: () => void;
  headingRef?: (element: HTMLElement | null) => void;
};

/**
 * One proposal (design.md §10): proposal text, provenance, evidence, and the
 * actions its status allows. Every action goes through the review state
 * machine; a toast confirms only after the store saved the change.
 */
export function ReviewItem({ item, ws, onLeftList, headingRef }: Props) {
  const run = useWorkspaceAction();
  const router = useRouter();
  const detailsId = useId();
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [editError, setEditError] = useState<string | undefined>();
  const [showOriginal, setShowOriginal] = useState(false);
  const [dismissOpen, setDismissOpen] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const provenance = provenanceOf(ws, item.sourceItemId);
  const evidence = findEvidence(ws, item.evidenceIds);
  const conflicting = hasConflictingEvidence(ws, item);
  const text = currentReviewText(item);
  const label = text.length > 60 ? `${text.slice(0, 59)}…` : text;

  function startEdit() {
    setDraft(text);
    setEditError(undefined);
    setEditing(true);
    setExpanded(true);
  }

  function saveEdit(event: FormEvent) {
    event.preventDefault();
    const outcome = run((current, now) => editReviewItem(current, item.id, draft, now), {
      success: { title: "Edit saved", description: "Approving will use your wording. The original proposal is kept." },
    });
    if (outcome.ok || outcome.applied) {
      setEditing(false);
      if (item.status !== "edited") onLeftList();
      return;
    }
    setEditError(outcome.fieldErrors?.text ?? outcome.fieldErrors?.[""] ?? outcome.error.message);
  }

  function approve(acknowledgeConflict: boolean) {
    const outcome = run((current, now) => approveReviewItem(current, item.id, { acknowledgeConflict }, now), {
      success: {
        title: "Approved and added to your portfolio draft. Not published.",
        action: {
          label: "View in portfolio",
          altText: "Open Portfolio from the navigation to see the approved item.",
          onClick: () => router.push("/portfolio"),
        },
      },
    });
    if (outcome.ok || outcome.applied) {
      setApproveOpen(false);
      onLeftList();
      return;
    }
    if (outcome.error.code === "conflict_unacknowledged") {
      setApproveOpen(true);
      return;
    }
    setActionError(outcome.error.message);
  }

  function simple(
    operation: (current: Workspace, now: string) => ReturnType<typeof restoreReviewItem>,
    success: { title: string; description?: string },
  ) {
    const outcome = run(operation, { success });
    if (outcome.ok || outcome.applied) {
      setActionError(null);
      onLeftList();
    } else {
      setActionError(outcome.error.message);
    }
  }

  return (
    <article className="flex flex-col gap-3 px-4 py-4 sm:px-5" aria-label={`${KIND_LABELS[item.kind]}: ${label}`}>
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-meta font-medium text-muted">{KIND_LABELS[item.kind]}</span>
          <ReviewStatusBadge status={item.status} />
          {evidence.map((record) => record.verification).filter((value, index, all) => all.indexOf(value) === index).map((verification) => (
            <VerificationBadge key={verification} verification={verification} />
          ))}
          {item.isDemo ? <DemoBadge /> : null}
        </div>
        <h3
          ref={headingRef}
          tabIndex={-1}
          className={expanded ? "text-subheading font-semibold break-words" : "line-clamp-2 text-subheading font-semibold break-words"}
        >
          {item.kind === "add_project" && item.proposedProject ? (
            <>
              {item.proposedProject.name}
              <span className="sr-only">: </span>
              <span className="block text-body font-normal text-foreground-secondary">{text}</span>
            </>
          ) : (
            text
          )}
        </h3>
        <p className="flex flex-wrap gap-x-3 gap-y-1 text-meta font-medium text-muted">
          {provenance ? (
            <span>
              {provenance.source.displayName} · {ITEM_KIND_LABELS[provenance.item.kind]}
            </span>
          ) : null}
          {provenance ? (
            <time dateTime={provenance.item.discoveredAt}>Discovered {formatDate(provenance.item.discoveredAt)}</time>
          ) : null}
          {item.decidedAt ? (
            <time dateTime={item.decidedAt}>
              {item.status === "approved" ? "Approved" : "Dismissed"} {formatDate(item.decidedAt)}
            </time>
          ) : null}
        </p>
        {conflicting && (item.status === "needs_review" || item.status === "edited") ? (
          <Alert tone="warning" title="Conflicting evidence">
            Sources for this item disagree. Expand the details to compare before approving.
          </Alert>
        ) : null}
        {item.status === "dismissed" && item.dismissReason ? (
          <p className="text-support text-foreground-secondary">Reason: {item.dismissReason}</p>
        ) : null}
      </div>

      {editing ? (
        <form noValidate onSubmit={saveEdit} className="flex flex-col gap-3">
          {item.kind === "add_skill" ? (
            <Field label="Skill name" required error={editError} hint="Up to 40 characters. The original proposal stays viewable.">
              <Input value={draft} maxLength={40} onChange={(event) => setDraft(event.target.value)} autoFocus />
            </Field>
          ) : (
            <Field label="Proposed text" required error={editError} hint="Your wording replaces the proposal. The original stays viewable.">
              <Textarea value={draft} maxLength={500} onChange={(event) => setDraft(event.target.value)} autoFocus />
            </Field>
          )}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="submit" variant="primary" size="sm">
              Save edit
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : null}

      {actionError ? <Alert tone="error" title="That didn't work">{actionError}</Alert> : null}

      <div className="flex flex-wrap items-center gap-2">
        {canPerform(item, "approve") && !editing ? (
          <Button
            variant="primary"
            size="sm"
            aria-label={`Approve “${label}”`}
            onClick={() => (conflicting ? setApproveOpen(true) : approve(false))}
          >
            <Check aria-hidden="true" size={16} strokeWidth={1.75} />
            Approve
          </Button>
        ) : null}
        {canPerform(item, "edit") && !editing ? (
          <Button variant="secondary" size="sm" aria-label={`Edit “${label}”`} onClick={startEdit}>
            <PenLine aria-hidden="true" size={16} strokeWidth={1.75} />
            Edit
          </Button>
        ) : null}
        {canPerform(item, "dismiss") && !editing ? (
          <Button variant="secondary" size="sm" aria-label={`Dismiss “${label}”`} onClick={() => setDismissOpen(true)}>
            <X aria-hidden="true" size={16} strokeWidth={1.75} />
            Dismiss
          </Button>
        ) : null}
        {canPerform(item, "revertEdit") && !editing ? (
          <ConfirmDialog
            trigger={
              <Button variant="ghost" size="sm" aria-label={`Revert edit of “${label}”`}>
                <Undo2 aria-hidden="true" size={16} strokeWidth={1.75} />
                Revert edit
              </Button>
            }
            title="Revert to the original proposal?"
            description={
              <>
                Your wording will be discarded:
                <span className="mt-2 block rounded-sm bg-surface-muted px-3 py-2 text-foreground">{item.editedText}</span>
              </>
            }
            confirmLabel="Revert edit"
            onConfirm={() => {
              const outcome = run((current, now) => revertReviewEdit(current, item.id, now), {
                success: { title: "Edit reverted", description: "The proposal is back in Needs review." },
              });
              if (!outcome.ok && !outcome.applied) throw new Error(outcome.error.message);
              onLeftList();
            }}
          />
        ) : null}
        {canPerform(item, "restore") ? (
          <Button
            variant="secondary"
            size="sm"
            aria-label={`Restore “${label}”`}
            onClick={() =>
              simple((current, now) => restoreReviewItem(current, item.id, now), {
                title: "Restored",
                description: "The proposal is back in Needs review.",
              })
            }
          >
            <RotateCcw aria-hidden="true" size={16} strokeWidth={1.75} />
            Restore
          </Button>
        ) : null}
        {item.status === "approved" ? (
          <Button asChild variant="secondary" size="sm">
            <Link href="/portfolio">View in portfolio</Link>
          </Button>
        ) : null}
        <Button
          variant="ghost"
          size="sm"
          aria-expanded={expanded}
          aria-controls={detailsId}
          onClick={() => setExpanded((value) => !value)}
          className="sm:ml-auto"
        >
          {expanded ? (
            <ChevronDown aria-hidden="true" size={16} strokeWidth={1.75} />
          ) : (
            <ChevronRight aria-hidden="true" size={16} strokeWidth={1.75} />
          )}
          {expanded ? "Hide details" : "Show evidence and source"}
        </Button>
      </div>

      {expanded ? (
        <div id={detailsId} className="grid gap-4 border-t border-border pt-4 md:grid-cols-2">
          <section className="flex flex-col gap-2">
            <h4 className="text-label font-semibold">Proposal</h4>
            <WordingLabel wording={item.status === "edited" ? "user" : item.wording} />
            {item.editedText ? (
              <div className="flex flex-col items-start gap-2">
                <Button variant="link" aria-expanded={showOriginal} onClick={() => setShowOriginal((value) => !value)}>
                  {showOriginal ? "Hide original proposal" : "Show original proposal"}
                </Button>
                {showOriginal ? (
                  <blockquote className="rounded-sm bg-surface-muted px-3 py-2 text-support text-foreground-secondary">
                    <span className="sr-only">Original proposal: </span>
                    {item.proposedText}
                    <span className="mt-1 block">
                      <WordingLabel wording={item.wording} />
                    </span>
                  </blockquote>
                ) : null}
              </div>
            ) : null}
            {item.kind === "add_project" && item.proposedProject && item.proposedProject.technologies.length > 0 ? (
              <p className="text-support text-foreground-secondary">
                Technologies: {item.proposedProject.technologies.join(", ")}
              </p>
            ) : null}
            <h4 className="mt-2 text-label font-semibold">Why suggested</h4>
            <p className="text-support text-foreground-secondary">{item.rationale}</p>
          </section>

          <section className="flex flex-col gap-2">
            <h4 className="text-label font-semibold">Source</h4>
            {provenance ? (
              <div className="flex flex-col gap-1 text-support text-foreground-secondary">
                <span className="font-medium text-foreground break-words">{provenance.item.title}</span>
                <span>
                  {ITEM_KIND_LABELS[provenance.item.kind]} from {provenance.source.displayName}
                </span>
                {provenance.item.occurredAt ? (
                  <time dateTime={provenance.item.occurredAt}>Dated {formatDate(provenance.item.occurredAt)}</time>
                ) : null}
                {provenance.item.url ? (
                  <ExternalLink href={provenance.item.url} isDemo={provenance.item.isDemo}>
                    Open source
                  </ExternalLink>
                ) : (
                  <span className="text-muted">No link was provided.</span>
                )}
              </div>
            ) : (
              <p className="text-support text-muted">The source item is missing.</p>
            )}
          </section>

          <section className="flex flex-col gap-2 md:col-span-2">
            <h4 className="text-label font-semibold">Evidence</h4>
            <ul className="flex flex-col divide-y divide-border rounded-sm border border-border">
              {evidence.map((record) => (
                <li key={record.id} className="flex flex-col gap-1.5 px-3 py-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <VerificationBadge verification={record.verification} />
                    <span className="text-meta font-medium text-muted">{verificationDescription(record.verification)}</span>
                  </div>
                  <p className="text-support break-words">{record.statement}</p>
                  {record.facts && record.facts.length > 0 ? (
                    <dl className="flex flex-wrap gap-x-4 gap-y-1">
                      {record.facts.map((fact, index) => (
                        <div key={`${fact.key}-${index}`} className="flex gap-1 font-mono text-code">
                          <dt className="text-muted">{fact.key}:</dt>
                          <dd className="break-all">{fact.value}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : null}
                  <time dateTime={record.capturedAt} className="text-meta font-medium text-muted">
                    Captured {formatDate(record.capturedAt)}
                  </time>
                </li>
              ))}
            </ul>
          </section>
        </div>
      ) : null}

      <DismissDialog
        open={dismissOpen}
        onOpenChange={setDismissOpen}
        label={label}
        onDismiss={(reason) => {
          const outcome = run((current, now) => dismissReviewItem(current, item.id, reason, now), {
            success: { title: "Dismissed. Evidence kept.", description: "Restore it from the Dismissed tab." },
          });
          if (outcome.ok || outcome.applied) {
            setDismissOpen(false);
            onLeftList();
            return null;
          }
          return outcome.fieldErrors?.reason ?? outcome.error.message;
        }}
      />
      <ConflictDialog
        open={approveOpen}
        onOpenChange={setApproveOpen}
        item={item}
        ws={ws}
        onApprove={() => approve(true)}
      />
    </article>
  );
}

function DismissDialog({
  open,
  onOpenChange,
  label,
  onDismiss,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label: string;
  onDismiss: (reason: string) => string | null;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | undefined>();
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setReason("");
          setError(undefined);
        }
        onOpenChange(next);
      }}
    >
      <DialogContent
        title="Dismiss this proposal?"
        description={`“${label}” leaves the queue. Its evidence and source item stay in your workspace, and you can restore it later.`}
        size="confirm"
      >
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            const failure = onDismiss(reason);
            setError(failure ?? undefined);
          }}
          className="flex flex-col gap-4"
        >
          <Field label="Reason" hint="Optional. Only for you." error={error}>
            <Input value={reason} maxLength={200} onChange={(event) => setReason(event.target.value)} />
          </Field>
          <DialogFooter>
            <Button type="submit" variant="primary">
              Dismiss proposal
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

/** Approval of a proposal with conflicting evidence requires acknowledgement (FR-EVID-04). */
function ConflictDialog({
  open,
  onOpenChange,
  item,
  ws,
  onApprove,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: ReviewItemModel;
  ws: Workspace;
  onApprove: () => void;
}) {
  const [checked, setChecked] = useState(false);
  const conflicts = findEvidence(ws, item.evidenceIds).filter((record) => record.verification === "conflicting");
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) setChecked(false);
        onOpenChange(next);
      }}
    >
      <DialogContent
        title="Check the conflict before approving"
        description="The evidence for this proposal disagrees. Both versions are kept; approving doesn't pick one."
      >
        <ul className="flex flex-col gap-2">
          {conflicts.map((record) => (
            <li key={record.id} className="rounded-sm border border-border px-3 py-2">
              <p className="text-support">{record.statement}</p>
              {record.facts && record.facts.length > 0 ? (
                <p className="mt-1 font-mono text-code text-muted break-all">
                  {record.facts.map((fact) => `${fact.key}: ${fact.value}`).join(" · ")}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
        <Checkbox
          label="I've checked this conflict"
          checked={checked}
          onCheckedChange={(value) => setChecked(value === true)}
        />
        <DialogFooter>
          <Button variant="primary" disabled={!checked} onClick={onApprove}>
            Approve
          </Button>
          <DialogClose asChild>
            <Button variant="secondary">Cancel</Button>
          </DialogClose>
        </DialogFooter>
        {!checked ? <p className="text-support text-muted">Confirm the checkbox to enable Approve.</p> : null}
      </DialogContent>
    </Dialog>
  );
}
