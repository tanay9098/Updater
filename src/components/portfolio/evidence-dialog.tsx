"use client";

import { FileSearch } from "lucide-react";
import { formatDate } from "@/lib/utils/dates";
import { findEvidence, provenanceOf } from "@/features/workspace/workspace";
import type { Workspace } from "@/types/domain";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { DemoBadge, VerificationBadge } from "@/components/workspace/badges";
import { ExternalLink } from "@/components/workspace/external-link";
import { ITEM_KIND_LABELS } from "@/components/review/labels";

/**
 * "Evidence (n)": lists the evidence behind a claim or skill with its
 * source and link (FR-PORT-04, design.md §11). Evidence is shown, never
 * edited, here.
 */
export function EvidenceDialog({
  ws,
  evidenceIds,
  subject,
  sourceRemoved = false,
}: {
  ws: Workspace;
  evidenceIds: string[];
  subject: string;
  sourceRemoved?: boolean;
}) {
  const evidence = findEvidence(ws, evidenceIds);
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={`Evidence (${evidence.length}) for “${subject}”`}>
          <FileSearch aria-hidden="true" size={16} strokeWidth={1.75} />
          Evidence ({evidence.length})
        </Button>
      </DialogTrigger>
      <DialogContent title="Evidence" description={`What supports “${subject}”.`}>
        {evidence.length === 0 ? (
          <p className="text-body text-foreground-secondary">
            {sourceRemoved
              ? "The source this came from was removed. No evidence remains."
              : "No linked evidence. This is a user-supplied statement you wrote yourself."}
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded-sm border border-border">
            {evidence.map((record) => {
              const provenance = provenanceOf(ws, record.sourceItemId);
              return (
                <li key={record.id} className="flex flex-col gap-1.5 px-3 py-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <VerificationBadge verification={record.verification} />
                    {record.isDemo ? <DemoBadge /> : null}
                  </div>
                  <p className="text-support break-words">{record.statement}</p>
                  {record.facts && record.facts.length > 0 ? (
                    <p className="font-mono text-code text-muted break-all">
                      {record.facts.map((fact) => `${fact.key}: ${fact.value}`).join(" · ")}
                    </p>
                  ) : null}
                  {provenance ? (
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-meta font-medium text-muted">
                      <span>
                        {ITEM_KIND_LABELS[provenance.item.kind]} “{provenance.item.title}” · {provenance.source.displayName}
                      </span>
                      <time dateTime={record.capturedAt}>Captured {formatDate(record.capturedAt)}</time>
                    </p>
                  ) : null}
                  {provenance?.item.url ? (
                    <ExternalLink href={provenance.item.url} isDemo={provenance.item.isDemo} className="text-support">
                      Open source
                    </ExternalLink>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
