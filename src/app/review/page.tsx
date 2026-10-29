import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { getNavItem } from "@/lib/navigation";

const page = getNavItem("review");

export const metadata: Metadata = { title: page.label };

export default function ReviewQueuePage() {
  return (
    <>
      <PageHeader title={page.label} description={page.description} />
      <EmptyState
        title="No items need review"
        description="Proposals will appear here once a source provides evidence. Nothing has been proposed, approved, or published."
      />
    </>
  );
}
