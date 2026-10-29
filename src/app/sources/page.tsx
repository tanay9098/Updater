import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { getNavItem } from "@/lib/navigation";

const page = getNavItem("sources");

export const metadata: Metadata = { title: page.label };

export default function SourcesPage() {
  return (
    <>
      <PageHeader title={page.label} description={page.description} />
      <EmptyState
        title="No sources yet"
        description="Manual entries and demo data aren't available in this version. No external service is connected and nothing has been imported."
      />
    </>
  );
}
