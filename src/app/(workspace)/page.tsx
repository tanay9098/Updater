import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { Overview } from "@/components/dashboard/overview";
import { WorkspaceGate } from "@/components/workspace/workspace-gate";
import { getNavItem } from "@/lib/navigation";

const page = getNavItem("overview");

// The root layout's title template only applies to nested segments.
export const metadata: Metadata = { title: { absolute: `${page.label} · Updater` } };

export default function OverviewPage() {
  return (
    <>
      <PageHeader title={page.label} description={page.description} />
      <WorkspaceGate>
        <Overview />
      </WorkspaceGate>
    </>
  );
}
