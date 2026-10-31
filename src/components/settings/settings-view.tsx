"use client";

import Link from "next/link";
import { PROVIDERS, presentStatus, providerStatus } from "@/lib/providers/registry";
import { AppearanceSettings } from "@/components/theme/appearance-settings";
import { Panel } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/status-badge";
import { ProfileForm } from "@/components/portfolio/profile-section";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { AccountSettings } from "./account-settings";
import { DataSettings } from "./data-settings";

/** Settings (design.md §13, FR-SET-01). */
export function SettingsView() {
  const ws = useWorkspace();
  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <section id="account" aria-labelledby="account-heading" className="scroll-mt-20 rounded-md border border-border bg-surface">
        <div className="border-b border-border px-4 py-4 sm:px-5">
          <h2 id="account-heading" className="text-heading font-semibold">
            Account
          </h2>
          <p className="text-support text-muted">Who this workspace belongs to.</p>
        </div>
        <div className="px-4 py-4 sm:px-5">
          <AccountSettings />
        </div>
      </section>

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
            . GitHub is a read-only public import, not a connected account.
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
          <li>
            Your workspace is stored in this browser&apos;s local storage, under your account. It isn&apos;t sent to
            Updater&apos;s server or any other service, except as described below. There are no analytics or tracking.
          </li>
          <li>
            Sign-in uses Google. Updater keeps your Google account ID, name, and email address only in an encrypted,
            HTTP-only sign-in cookie. No passwords or Google access tokens are stored.
          </li>
          <li>
            Other accounts signing in on this browser can&apos;t open your workspace in Updater. Anyone with access to
            this browser profile could still read the stored data with developer tools.
          </li>
          <li>Signing out keeps your workspace in this browser for your next sign-in. Reset it below to delete it.</li>
          <li>The workspace doesn&apos;t follow your account to other devices or browsers. Export and import to move it.</li>
          <li>Clearing this site&apos;s data in your browser deletes the workspace. Export a copy to keep a backup.</li>
          <li>
            Importing from GitHub sends only the username you enter to Updater&apos;s server, which reads that
            account&apos;s public repositories from GitHub&apos;s API and returns them to this browser. The server keeps
            nothing, and no GitHub sign-in or token is involved on your side.
          </li>
          <li>
            Publishing sends the public copy of your saved portfolio (no email address, no demo data) through
            Updater&apos;s server to the gh-pages branch of your own &lt;username&gt;.github.io repository, where anyone can
            see it. Connecting GitHub keeps only your GitHub account ID and username in an encrypted, HTTP-only cookie in
            this browser; no GitHub token is stored.
          </li>
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
