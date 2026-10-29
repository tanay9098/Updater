import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { getNavItem } from "@/lib/navigation";

const page = getNavItem("overview");

// The root layout's title template only applies to nested segments.
export const metadata: Metadata = { title: { absolute: `${page.label} · Updater` } };

export default function OverviewPage() {
  return (
    <>
      <PageHeader title={page.label} description={page.description} />
      <EmptyState
        title="Nothing to summarize yet"
        description="Updater has no profile, sources, or evidence stored for you. Workspace storage, sources, and the review queue aren't built in this version, so this page has nothing to report."
      />
    </>
  );
}
