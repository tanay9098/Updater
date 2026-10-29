import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { AppearanceSettings } from "@/components/theme/appearance-settings";
import { EmptyState } from "@/components/ui/empty-state";
import { Panel } from "@/components/ui/panel";
import { getNavItem } from "@/lib/navigation";

const page = getNavItem("settings");

export const metadata: Metadata = { title: page.label };

export default function SettingsPage() {
  return (
    <>
      <PageHeader title={page.label} description={page.description} />
      <div className="flex max-w-2xl flex-col gap-8">
        <Panel
          title="Appearance"
          description="Applies immediately. The choice is saved in this browser and also follows the theme button in the top bar."
        >
          <AppearanceSettings />
        </Panel>
        <EmptyState
          title="More settings arrive with workspace storage"
          description="Profile basics, the integration status summary, privacy details, and data export, import, and reset aren't built in this version."
        />
      </div>
    </>
  );
}
