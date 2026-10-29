"use client";

import Link from "next/link";
import { PROVIDERS, presentStatus, providerStatus } from "@/lib/providers/registry";
import { AppearanceSettings } from "@/components/theme/appearance-settings";
import { Panel } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/status-badge";
import { ProfileForm } from "@/components/portfolio/profile-section";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { DataSettings } from "./data-settings";

/** Settings (design.md §13, FR-SET-01). */
export function SettingsView() {
  const ws = useWorkspace();
  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <Panel
        title="Profile basics"
        description={
          <>
            Name and headline. Edit the introduction, contact details, and links in the{" "}
            <Link href="/portfolio" className="text-link underline underline-offset-4">
              Portfolio editor
            </Link>
            .
          </>
        }
      >
        <ProfileForm
          key={JSON.stringify([ws.profile?.name, ws.profile?.headline])}
          profile={ws.profile}
          fields="basics"
        />
      </Panel>

      <Panel
        title="Appearance"
        description="Applies immediately. The choice is saved in this browser and also follows the theme button in the top bar."
      >
        <AppearanceSettings />
      </Panel>

      <Panel
        title="Integrations"
        description={
          <>
            The same statuses as on{" "}
            <Link href="/sources" className="text-link underline underline-offset-4">
              Sources
            </Link>
            . No external service is connected in this version.
          </>
        }
      >
        <ul className="flex flex-col divide-y divide-border">
          {PROVIDERS.map((provider) => {
            const status = presentStatus(provider, providerStatus(provider, ws));
            return (
              <li key={provider.id} className="flex flex-col gap-1 py-2.5 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-label font-medium">{provider.displayName}</span>
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-meta font-medium text-muted">{provider.syncNote}</span>
                  <StatusBadge tone={status.tone} label={status.label} />
                </span>
              </li>
            );
          })}
        </ul>
      </Panel>

      <Panel title="Privacy" description="How this version handles your data.">
        <ul className="flex list-disc flex-col gap-1.5 pl-5 text-body text-foreground-secondary">
          <li>Your workspace is stored only in this browser&apos;s local storage, on this device.</li>
          <li>Nothing is sent to Updater servers or any other service. There are no analytics or tracking.</li>
          <li>No passwords, API keys, or access tokens are stored. No account is needed.</li>
          <li>Anyone with access to this browser profile can read the stored data.</li>
          <li>Clearing this site&apos;s data in your browser deletes the workspace. Export a copy to keep a backup.</li>
          <li>Demo data is fictional and links only to example.com.</li>
        </ul>
      </Panel>

      <section aria-labelledby="data-heading" id="data" className="scroll-mt-20 rounded-md border border-border bg-surface">
        <div className="border-b border-border px-4 py-4 sm:px-5">
          <h2 id="data-heading" className="text-heading font-semibold">
            Data
          </h2>
          <p className="text-support text-muted">Export, import, and delete what is stored in this browser.</p>
        </div>
        <div className="px-4 py-4 sm:px-5">
          <DataSettings />
        </div>
      </section>
    </div>
  );
}
