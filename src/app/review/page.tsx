import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { ReviewQueue } from "@/components/review/review-queue";
import { WorkspaceGate } from "@/components/workspace/workspace-gate";
import { getNavItem } from "@/lib/navigation";

const page = getNavItem("review");

export const metadata: Metadata = { title: page.label };

export default function ReviewQueuePage() {
  return (
    <>
      <PageHeader title={page.label} description={page.description} />
      <WorkspaceGate>
        <ReviewQueue />
      </WorkspaceGate>
    </>
  );
}
