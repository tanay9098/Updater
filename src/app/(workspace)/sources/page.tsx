import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { SourcesView } from "@/components/sources/sources-view";
import { WorkspaceGate } from "@/components/workspace/workspace-gate";
import { getNavItem } from "@/lib/navigation";

const page = getNavItem("sources");

export const metadata: Metadata = { title: page.label };

export default function SourcesPage() {
  return (
    <>
      <PageHeader title={page.label} description={page.description} />
      <WorkspaceGate>
        <SourcesView />
      </WorkspaceGate>
    </>
  );
}
