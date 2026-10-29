"use client";

import { useId, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { PROVIDERS, findSourceForProvider, presentStatus, providerStatus } from "@/lib/providers/registry";
import type { ProviderDescriptor } from "@/lib/providers/types";
import { formatDate } from "@/lib/utils/dates";
import { evidenceForItem, hasDemoData } from "@/features/workspace/workspace";
import type { SourceItem, Workspace } from "@/types/domain";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { DemoBadge, ReviewStatusBadge, VerificationBadge } from "@/components/workspace/badges";
import { ExternalLink } from "@/components/workspace/external-link";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { ITEM_KIND_LABELS } from "@/components/review/labels";
import { LoadDemoButton, RemoveDemoDataButton } from "./demo-data-controls";
import { ManualEntryDialog } from "./manual-entry-dialog";

const KIND_LABELS: Record<ProviderDescriptor["kind"], string> = {
  local: "Stored in this browser",
  code_host: "Code host",
  publishing: "Publishing",
  fixture: "Fixture data",
};

/** Sources (design.md §9). Statuses come from real workspace state only. */
export function SourcesView() {
  const ws = useWorkspace();
  return (
    <div className="flex flex-col gap-6">
      {hasDemoData(ws) ? (
        <Alert tone="info" title="Your workspace includes demo data">
          Demo items are fictional. They were not retrieved from any account, and their links point to example.com.
        </Alert>
      ) : null}
      <p className="max-w-prose text-body text-foreground-secondary">
        No external service is connected in this version. Manual entries work locally; GitHub and blog feeds are
        planned and have no connect button yet.
      </p>
      {PROVIDERS.map((provider) => (
        <ProviderPanel key={provider.id} provider={provider} ws={ws} />
      ))}
    </div>
  );
}

function ProviderPanel({ provider, ws }: { provider: ProviderDescriptor; ws: Workspace }) {
  const headingId = useId();
  const status = presentStatus(provider, providerStatus(provider, ws));
  const source = findSourceForProvider(ws, provider.id);
  const items = source ? ws.sourceItems.filter((item) => item.sourceId === source.id) : [];

  return (
    <section aria-labelledby={headingId} className="rounded-md border border-border bg-surface">
      <div className="flex flex-col gap-3 border-b border-border px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id={headingId} className="text-heading font-semibold">
              {provider.displayName}
            </h2>
            <StatusBadge tone={status.tone} label={status.label} />
          </div>
          <p className="text-meta font-medium text-muted">{KIND_LABELS[provider.kind]}</p>
          <p className="text-body text-foreground-secondary">{provider.summary}</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {provider.id === "manual" ? <ManualEntryDialog /> : null}
          {provider.id === "demo" ? source ? <RemoveDemoDataButton /> : <LoadDemoButton /> : null}
        </div>
      </div>

      <div className="grid gap-4 px-4 py-4 sm:px-5 md:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <h3 className="text-label font-semibold">What it provides</h3>
          <ul className="flex flex-col gap-1">
            {provider.capabilities.map((capability) => (
              <li key={capability.id} className="text-support text-foreground-secondary">
                <span className="font-medium text-foreground">{capability.label}:</span> {capability.description}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col gap-1.5">
          <h3 className="text-label font-semibold">Permissions</h3>
          <p className="text-support text-foreground-secondary">
            <span className="font-medium text-foreground">Reads:</span> {provider.permissions.reads.join(" ")}
          </p>
          <p className="text-support text-foreground-secondary">
            <span className="font-medium text-foreground">Never:</span> {provider.permissions.never.join(" ")}
          </p>
        </div>
        <div className="flex flex-col gap-1.5 md:col-span-2">
          <h3 className="text-label font-semibold">{provider.availability === "planned" ? "Not available yet" : "Setup"}</h3>
          <ul className="flex flex-col gap-1">
            {provider.setupNotes.map((note) => (
              <li key={note} className="text-support text-foreground-secondary">
                {note}
              </li>
            ))}
          </ul>
          <p className="text-meta font-medium text-muted">{provider.syncNote}</p>
        </div>
      </div>

      {provider.availability !== "planned" ? <SourceItems provider={provider} items={items} ws={ws} /> : null}
    </section>
  );
}

function SourceItems({ provider, items, ws }: { provider: ProviderDescriptor; items: SourceItem[]; ws: Workspace }) {
  const [expanded, setExpanded] = useState(provider.id === "manual");
  const listId = useId();

  if (items.length === 0) {
    return (
      <p className="border-t border-border px-4 py-3 text-support text-muted sm:px-5">
        {provider.id === "manual"
          ? "No entries yet. Use “Add entry” to record a project, article, contribution, or achievement."
          : "Not loaded. Nothing from this source is in your workspace."}
      </p>
    );
  }

  const sorted = [...items].sort((a, b) => b.discoveredAt.localeCompare(a.discoveredAt));

  return (
    <div className="border-t border-border">
      <Button
        variant="ghost"
        className="h-11 w-full justify-start rounded-none px-4 sm:px-5"
        aria-expanded={expanded}
        aria-controls={listId}
        onClick={() => setExpanded((value) => !value)}
      >
        {expanded ? (
          <ChevronDown aria-hidden="true" size={16} strokeWidth={1.75} />
        ) : (
          <ChevronRight aria-hidden="true" size={16} strokeWidth={1.75} />
        )}
        {expanded ? "Hide" : "Show"} {items.length} {items.length === 1 ? "item" : "items"}
      </Button>
      {expanded ? (
        <ul id={listId} className="flex flex-col divide-y divide-border border-t border-border">
          {sorted.map((item) => {
            const evidence = evidenceForItem(ws, item.id);
            const proposals = ws.reviewItems.filter((review) => review.sourceItemId === item.id);
            return (
              <li key={item.id} className="flex flex-col gap-2 px-4 py-3 sm:px-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-label font-medium break-words">{item.title}</span>
                  {item.isDemo ? <DemoBadge /> : null}
                </div>
                <p className="flex flex-wrap gap-x-3 gap-y-1 text-meta font-medium text-muted">
                  <span>{ITEM_KIND_LABELS[item.kind]}</span>
                  {item.occurredAt ? <time dateTime={item.occurredAt}>Dated {formatDate(item.occurredAt)}</time> : null}
                  <time dateTime={item.discoveredAt}>Added {formatDate(item.discoveredAt)}</time>
                  <span>
                    {evidence.length} evidence {evidence.length === 1 ? "record" : "records"}
                  </span>
                </p>
                {item.url ? (
                  <ExternalLink href={item.url} isDemo={item.isDemo} className="text-support">
                    Open source
                  </ExternalLink>
                ) : null}
                {evidence.length > 0 ? (
                  <ul className="flex flex-col gap-1.5">
                    {evidence.map((record) => (
                      <li key={record.id} className="flex flex-wrap items-center gap-2 text-support text-foreground-secondary">
                        <VerificationBadge verification={record.verification} />
                        <span className="min-w-0 break-words">{record.statement}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {proposals.length > 0 ? (
                  <p className="flex flex-wrap items-center gap-2 text-meta font-medium text-muted">
                    Proposals:
                    {proposals.map((review) => (
                      <ReviewStatusBadge key={review.id} status={review.status} />
                    ))}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
