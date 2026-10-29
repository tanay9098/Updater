"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { REVIEW_STATUSES } from "@/lib/validation/domain";
import type { ReviewStatus } from "@/types/domain";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { REVIEW_STATUS_LABELS } from "@/components/workspace/badges";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { ReviewItem } from "./review-item";

const EMPTY_COPY: Record<ReviewStatus, { title: string; description: string }> = {
  needs_review: {
    title: "No items need review",
    description: "Proposals appear here when you add evidence under Sources.",
  },
  edited: { title: "No edited proposals", description: "Proposals you reword before approving appear here." },
  approved: {
    title: "Nothing approved yet",
    description: "Approved proposals are added to your portfolio draft. Approval never publishes anything.",
  },
  dismissed: {
    title: "Nothing dismissed",
    description: "Dismissed proposals keep their evidence and can be restored from here.",
  },
};

/** Review Queue (design.md §10, FR-REV-01/02). Defaults to "Needs review". */
export function ReviewQueue() {
  const ws = useWorkspace();
  const [tab, setTab] = useState<ReviewStatus>("needs_review");
  const headings = useRef(new Map<string, HTMLElement>());
  const pendingFocus = useRef<{ status: ReviewStatus; index: number } | null>(null);
  const tabListRef = useRef<HTMLDivElement>(null);

  const byStatus = Object.fromEntries(
    REVIEW_STATUSES.map((status) => [
      status,
      ws.reviewItems
        .filter((item) => item.status === status)
        .sort((a, b) =>
          status === "approved" || status === "dismissed"
            ? (b.decidedAt ?? b.updatedAt).localeCompare(a.decidedAt ?? a.updatedAt)
            : a.createdAt.localeCompare(b.createdAt),
        ),
    ]),
  ) as Record<ReviewStatus, typeof ws.reviewItems>;

  // After an action removes an item from the current tab, focus moves to the
  // next item (or the previous one, or the tab list) instead of being lost.
  useEffect(() => {
    const target = pendingFocus.current;
    if (!target) return;
    pendingFocus.current = null;
    const list = byStatus[target.status];
    const next = list[Math.min(target.index, list.length - 1)];
    const element = next ? headings.current.get(next.id) : undefined;
    if (element) element.focus();
    else tabListRef.current?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')?.focus();
  });

  if (ws.reviewItems.length === 0) {
    return (
      <EmptyState
        title="No proposals yet"
        description="Add a manual entry or load the fictional demo workspace under Sources. Each entry becomes a proposal you can edit, approve, or dismiss here."
        action={
          <Button asChild variant="primary">
            <Link href="/sources">Go to Sources</Link>
          </Button>
        }
      />
    );
  }

  return (
    <Tabs value={tab} onValueChange={(value) => setTab(value as ReviewStatus)}>
      <TabsList ref={tabListRef} aria-label="Filter proposals by status">
        {REVIEW_STATUSES.map((status) => (
          <TabsTrigger key={status} value={status}>
            {REVIEW_STATUS_LABELS[status]}
            <span
              aria-hidden="true"
              className="rounded-sm bg-surface-muted px-1.5 text-meta font-medium text-foreground-secondary"
            >
              {byStatus[status].length}
            </span>
            <span className="sr-only">, {byStatus[status].length}</span>
          </TabsTrigger>
        ))}
      </TabsList>
      {REVIEW_STATUSES.map((status) => (
        <TabsContent key={status} value={status}>
          {byStatus[status].length === 0 ? (
            <EmptyState title={EMPTY_COPY[status].title} description={EMPTY_COPY[status].description} />
          ) : (
            <ul className="flex flex-col divide-y divide-border rounded-md border border-border bg-surface">
              {byStatus[status].map((item, index) => (
                <li key={item.id}>
                  <ReviewItem
                    item={item}
                    ws={ws}
                    headingRef={(element) => {
                      if (element) headings.current.set(item.id, element);
                      else headings.current.delete(item.id);
                    }}
                    onLeftList={() => {
                      pendingFocus.current = { status, index };
                    }}
                  />
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      ))}
    </Tabs>
  );
}
