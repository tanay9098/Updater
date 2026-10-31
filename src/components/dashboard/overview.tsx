"use client";

import Link from "next/link";
import { ArrowRight, Check, Minus } from "lucide-react";
import { PROVIDERS, findSourceForProvider, presentStatus, providerStatus } from "@/lib/providers/registry";
import { formatDate, formatDateTime } from "@/lib/utils/dates";
import { nextAction, pendingReviewItems, portfolioCounts, recentActivity, recentEvidence } from "@/features/overview/summary";
import { profileChecklist } from "@/features/profile/profile";
import { currentReviewText, findSourceItem, hasDemoData, provenanceOf } from "@/features/workspace/workspace";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/status-badge";
import { DemoBadge, PublicationBadge, ReviewStatusBadge, VerificationBadge } from "@/components/workspace/badges";
import { useWorkspace, useWorkspaceSnapshot } from "@/components/workspace/workspace-provider";
import { KIND_LABELS } from "@/components/review/labels";
import { ExternalLink } from "@/components/workspace/external-link";
import type { PublishingState } from "@/types/domain";

/** Overview (design.md §8). Everything shown is derived from stored workspace records. */
export function Overview() {
  const ws = useWorkspace();
  const snapshot = useWorkspaceSnapshot();
  const action = nextAction(ws);
  const checklist = profileChecklist(ws);
  const counts = portfolioCounts(ws);
  const pending = pendingReviewItems(ws);
  const evidence = recentEvidence(ws);
  const activity = recentActivity(ws);
  const saveError = snapshot.phase === "ready" && snapshot.save.state === "error" ? snapshot.save.error : null;

  return (
    <div className="flex flex-col gap-6">
      {saveError ? (
        <Alert tone="error" title="Changes could not be saved">
          {saveError.message} Changes stay in this tab until you reload. Use “Retry save” in the save status.
        </Alert>
      ) : null}
      {hasDemoData(ws) ? (
        <Alert
          tone="info"
          title="Your workspace includes demo data"
          action={
            <Button asChild variant="secondary" size="sm">
              <Link href="/settings#data">Remove demo data</Link>
            </Button>
          }
        >
          Items labeled “Demo data” are fictional and link only to example.com.
        </Alert>
      ) : null}

      <section aria-labelledby="next-action-heading" className="rounded-md border border-border bg-surface px-4 py-5 sm:px-5">
        <p className="text-meta font-medium text-muted">Next action</p>
        <h2 id="next-action-heading" className="mt-1 text-heading font-semibold">
          {action.title}
        </h2>
        <p className="mt-1 max-w-prose text-body text-foreground-secondary">{action.description}</p>
        <Button asChild variant="primary" className="mt-4">
          <Link href={action.href}>
            {action.label}
            <ArrowRight aria-hidden="true" size={16} strokeWidth={1.75} />
          </Link>
        </Button>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Portfolio status" description="Draft saved in this browser.">
          <ul className="flex flex-col gap-2">
            {checklist.map((item) => (
              <li key={item.id} className="flex items-center gap-2 text-body">
                {item.done ? (
                  <Check aria-hidden="true" size={16} strokeWidth={1.75} className="text-success" />
                ) : (
                  <Minus aria-hidden="true" size={16} strokeWidth={1.75} className="text-muted" />
                )}
                <span className={item.done ? "" : "text-foreground-secondary"}>
                  {item.label}
                  <span className="sr-only">{item.done ? ": done" : ": missing"}</span>
                </span>
                {!item.done ? <span className="text-meta font-medium text-muted">({item.hint})</span> : null}
              </li>
            ))}
          </ul>
          <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-border pt-4">
            <Count label="Approved achievements" value={counts.approvedClaims} />
            <Count label="Visible projects" value={counts.visibleProjects} />
            <Count label="Skills" value={counts.skills} />
          </dl>
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
            <PublicationBadge status={ws.portfolio.publishing.status} />
            <PublicationNote publishing={ws.portfolio.publishing} />
          </div>
        </Panel>

        <Panel
          title="Sources"
          actions={
            <Button asChild variant="secondary" size="sm">
              <Link href="/sources">Open Sources</Link>
            </Button>
          }
        >
          <ul className="flex flex-col divide-y divide-border">
            {PROVIDERS.map((provider) => {
              const status = presentStatus(provider, providerStatus(provider, ws));
              const source = findSourceForProvider(ws, provider.id);
              const itemCount = source ? ws.sourceItems.filter((item) => item.sourceId === source.id).length : 0;
              return (
                <li key={provider.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
                  <span className="text-label font-medium">{provider.displayName}</span>
                  <span className="flex items-center gap-2">
                    {provider.availability !== "planned" ? (
                      <span className="text-meta font-medium text-muted">
                        {itemCount} {itemCount === 1 ? "item" : "items"}
                      </span>
                    ) : null}
                    <StatusBadge tone={status.tone} label={status.label} />
                  </span>
                </li>
              );
            })}
          </ul>
        </Panel>

        <Panel
          title="Pending review"
          actions={
            <Button asChild variant="secondary" size="sm">
              <Link href="/review">Open Review Queue</Link>
            </Button>
          }
        >
          {pending.length === 0 ? (
            <p className="text-body text-foreground-secondary">
              No proposals are waiting. New ones appear when you add evidence under Sources.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {pending.map((item) => {
                const provenance = provenanceOf(ws, item.sourceItemId);
                return (
                  <li key={item.id} className="flex flex-col gap-1 py-2.5 first:pt-0 last:pb-0">
                    <span className="line-clamp-2 text-body">{currentReviewText(item)}</span>
                    <span className="flex flex-wrap items-center gap-2 text-meta font-medium text-muted">
                      {KIND_LABELS[item.kind]}
                      {provenance ? ` · ${provenance.source.displayName}` : ""}
                      <ReviewStatusBadge status={item.status} />
                      {item.isDemo ? <DemoBadge /> : null}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel title="Recent evidence">
          {evidence.length === 0 ? (
            <p className="text-body text-foreground-secondary">
              No evidence yet. Add a manual entry or load the demo workspace under Sources.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {evidence.map((record) => {
                const item = findSourceItem(ws, record.sourceItemId);
                const provenance = item ? provenanceOf(ws, item.id) : undefined;
                return (
                  <li key={record.id} className="flex flex-col gap-1 py-2.5 first:pt-0 last:pb-0">
                    <span className="text-label font-medium">{item?.title ?? "Unknown item"}</span>
                    <span className="line-clamp-2 text-support text-foreground-secondary">{record.statement}</span>
                    <span className="flex flex-wrap items-center gap-2 text-meta font-medium text-muted">
                      <time dateTime={record.capturedAt}>Captured {formatDate(record.capturedAt)}</time>
                      {provenance ? ` · ${provenance.source.displayName}` : ""}
                      <VerificationBadge verification={record.verification} />
                      {record.isDemo ? <DemoBadge /> : null}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel title="Recent portfolio changes" description="Only actions you took in Updater." className="lg:col-span-2">
          {activity.length === 0 ? (
            <p className="text-body text-foreground-secondary">Nothing yet. Changes you make appear here.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {activity.map((entry) => (
                <li key={entry.id} className="flex flex-col gap-0.5 py-2.5 first:pt-0 last:pb-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                  <span className="text-body">{entry.summary}</span>
                  <time dateTime={entry.at} className="shrink-0 text-meta font-medium text-muted">
                    {formatDateTime(entry.at)}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-meta font-medium text-muted">{label}</dt>
      <dd className="text-heading font-semibold">{value}</dd>
    </div>
  );
}

/** Where the portfolio is published, only as GitHub Pages confirmed it (rules.md §7.1.9). */
function PublicationNote({ publishing }: { publishing: PublishingState }) {
  if (publishing.publisherId === null) {
    return (
      <span className="text-support text-muted">
        Publish from the <Link href="/portfolio" className="text-link underline underline-offset-4">Portfolio</Link> page.
      </span>
    );
  }
  if (publishing.live) {
    return (
      <span className="text-support text-muted">
        {publishing.status === "published" ? "Live at" : "Last published version:"}{" "}
        <ExternalLink href={publishing.live.url}>{publishing.live.url}</ExternalLink>
      </span>
    );
  }
  return <span className="text-support text-muted">GitHub Pages hasn&apos;t confirmed a published version yet.</span>;
}
