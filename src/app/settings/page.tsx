import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { SettingsView } from "@/components/settings/settings-view";
import { WorkspaceGate } from "@/components/workspace/workspace-gate";
import { getNavItem } from "@/lib/navigation";

const page = getNavItem("settings");

export const metadata: Metadata = { title: page.label };

export default function SettingsPage() {
  return (
    <>
      <PageHeader title={page.label} description={page.description} />
      <WorkspaceGate>
        <SettingsView />
      </WorkspaceGate>
    </>
  );
}
