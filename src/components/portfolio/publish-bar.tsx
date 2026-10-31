"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Globe, Plug, RefreshCw } from "lucide-react";
import { formatDateTime, formatTime } from "@/lib/utils/dates";
import {
  CONNECT_PATH,
  requestBuildStatus,
  requestDisconnect,
  requestSite,
  type ClientFailure,
  type SiteInfoView,
  type SiteResponse,
} from "@/lib/publishers/github-pages/contract";
import { buildPublicSnapshot } from "@/features/publishing/snapshot";
import {
  confirmPublished,
  githubPagesState,
  hasUnpublishedChanges,
  recordPublishFailure,
  sameRepository,
} from "@/features/publishing/state";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Spinner } from "@/components/ui/spinner";
import { PublicationBadge } from "@/components/workspace/badges";
import { ExternalLink } from "@/components/workspace/external-link";
import { useWorkspace, useWorkspaceAction, useWorkspaceSnapshot } from "@/components/workspace/workspace-provider";
import { PublishDialog } from "./publish-dialog";

type SiteLoad = { phase: "loading" } | { phase: "loaded"; value: SiteResponse } | { phase: "failed"; error: ClientFailure };

/** How often, and how long, the page asks GitHub whether the site was built. */
export const POLL_INTERVAL_MS = 5_000;
export const MAX_POLLS = 36;

function failureText(error: { message: string; resetAt?: string }): string {
  return error.resetAt ? `${error.message} Try again after ${formatTime(error.resetAt)}.` : error.message;
}

/**
 * The Portfolio page's draft and publication bar (T10.9, design.md §11.1).
 * Publishing writes the saved draft's public copy to the developer's own
 * `<login>.github.io` repository through Updater's server. The badge says
 * "Published" only after GitHub Pages reported the build of the commit
 * Updater wrote (rules.md §7.1.9).
 */
export function PublishBar() {
  const ws = useWorkspace();
  const snapshot = useWorkspaceSnapshot();
  const run = useWorkspaceAction();
  const [site, setSite] = useState<SiteLoad>({ phase: "loading" });
  const [siteRequest, setSiteRequest] = useState(0);
  const [progress, setProgress] = useState<{ commitSha: string; polls: number; note?: string } | null>(null);

  const publishing = ws.portfolio.publishing;
  const pages = githubPagesState(ws);
  const publicCopy = useMemo(() => buildPublicSnapshot(ws), [ws]);
  const changed = publicCopy.ok && hasUnpublishedChanges(ws, publicCopy.value.contentHash);

  useEffect(() => {
    let active = true;
    void requestSite().then((outcome) => {
      if (active) setSite(outcome.ok ? { phase: "loaded", value: outcome.value } : { phase: "failed", error: outcome.error });
    });
    return () => {
      active = false;
    };
  }, [siteRequest]);

  const reloadSite = useCallback(() => {
    setSite({ phase: "loading" });
    setSiteRequest((count) => count + 1);
  }, []);

  // Waits for GitHub Pages to build the pending commit, also after a reload while a publish was in progress.
  const pendingCommit = pages?.status === "publishing" ? pages.pending?.commitSha : undefined;
  const polling = pendingCommit ? (progress?.commitSha === pendingCommit ? progress : { commitSha: pendingCommit, polls: 0 }) : null;
  const pollCommit = polling?.commitSha;
  const polls = polling?.polls ?? 0;

  useEffect(() => {
    if (!pollCommit || polls >= MAX_POLLS) return;
    let cancelled = false;
    const timer = window.setTimeout(
      async () => {
        const outcome = await requestBuildStatus(pollCommit);
        if (cancelled) return;
        const next = (note?: string) => setProgress({ commitSha: pollCommit, polls: polls + 1, note });
        if (!outcome.ok) return outcome.error.code === "signed_out" ? setProgress({ commitSha: pollCommit, polls: MAX_POLLS, note: outcome.error.message }) : next(failureText(outcome.error));
        if (!outcome.value.ok) return next(failureText(outcome.value.error));
        const status = outcome.value.value;
        switch (status.state) {
          case "building":
            return next();
          case "not_serving":
            return next("GitHub Pages isn't serving the gh-pages branch yet. Turn it on in the repository's Pages settings: Deploy from a branch → gh-pages → / (root).");
          case "built":
            run((current, now) => confirmPublished(current, { commitSha: pollCommit, url: status.url, publishedAt: status.builtAt }, now), {
              success: { title: "Your portfolio is published", description: `It's live at ${status.url}.` },
              announceRefusal: true,
            });
            return;
          case "errored":
          case "superseded":
            run(
              (current, now) =>
                recordPublishFailure(
                  current,
                  {
                    message:
                      status.state === "errored"
                        ? status.message
                        : "Another publish replaced this one before GitHub built it. Publish again to put this version online.",
                  },
                  now,
                ),
              { announceRefusal: true },
            );
            return;
        }
      },
      polls === 0 ? 1_000 : POLL_INTERVAL_MS,
    );
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [pollCommit, polls, run]);

  const save = snapshot.phase === "ready" ? snapshot.save : null;
  const saveText =
    save?.state === "saved"
      ? `Saved locally ${formatTime(save.savedAt)}`
      : save?.state === "error"
        ? "Not saved: see the save status"
        : "Stored in this browser";

  return (
    <section
      aria-labelledby="publish-heading"
      className="flex flex-col gap-3 rounded-md border border-border bg-surface px-4 py-3 sm:px-5"
    >
      <h2 id="publish-heading" className="sr-only">
        Draft and publication
      </h2>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="flex flex-wrap items-center gap-2 text-label font-medium">
            <span>Draft</span>
            <span aria-hidden="true" className="text-muted">·</span>
            <span className={save?.state === "error" ? "text-error" : "text-foreground-secondary"}>{saveText}</span>
            <span aria-hidden="true" className="text-muted">·</span>
            <PublicationBadge status={publishing.status} />
            {changed ? <span className="text-meta font-medium text-warning">Changes since last publish</span> : null}
          </p>
          {pages?.live ? (
            <p className="text-support text-foreground-secondary">
              Live at <ExternalLink href={pages.live.url}>{pages.live.url}</ExternalLink> · published {formatDateTime(pages.live.publishedAt)}
            </p>
          ) : null}
          <p id="publish-help" className="text-support text-muted">
            <SiteHelp site={site} />
          </p>
        </div>
        <PublishActions site={site} publicCopy={publicCopy} onReload={reloadSite} />
      </div>

      {pages?.status === "publishing" ? (
        <Alert tone="info" title="Publishing">
          {polling && polling.polls < MAX_POLLS ? (
            <span className="inline-flex items-center gap-2">
              <Spinner /> GitHub Pages is building your site. This usually takes a minute.
            </span>
          ) : (
            <span>GitHub Pages hasn&apos;t reported the build yet.</span>
          )}
          {polling?.note ? <span className="mt-1 block">{polling.note}</span> : null}
          {!polling || polling.polls >= MAX_POLLS ? (
            <Button
              size="sm"
              variant="secondary"
              className="mt-2"
              onClick={() => pages.pending && setProgress({ commitSha: pages.pending.commitSha, polls: 0 })}
            >
              <RefreshCw aria-hidden="true" size={16} strokeWidth={1.75} />
              Check status
            </Button>
          ) : null}
        </Alert>
      ) : null}
      {pages?.status === "failed" && pages.lastError ? (
        <Alert tone="error" title="The last publish didn't go online">
          {pages.lastError.message}
          {pages.live ? " Your previously published version is still live." : null}
        </Alert>
      ) : null}
      {!publicCopy.ok && site.phase === "loaded" && site.value.state === "ready" ? (
        <Alert tone="warning" title="Not ready to publish">
          {publicCopy.error.message}
        </Alert>
      ) : null}
      {site.phase === "loaded" && site.value.state === "ready" && pages && !sameRepository(pages.repository, site.value.site.repository) ? (
        <Alert tone="info" title="A different repository">
          Your last publish went to {pages.repository}. Publishing now goes to {site.value.site.repository}.
        </Alert>
      ) : null}
      <SetupSteps site={site} onReload={reloadSite} />
    </section>
  );
}

function SiteHelp({ site }: { site: SiteLoad }) {
  if (site.phase === "loading") return <>Checking your GitHub Pages site…</>;
  if (site.phase === "failed") return <>{failureText(site.error)}</>;
  const value = site.value;
  switch (value.state) {
    case "unavailable":
      return <>Publishing isn&apos;t set up on this server. Use the preview to check your portfolio.</>;
    case "not_linked":
      return <>Publish to your own GitHub Pages site. Connect your GitHub account to start.</>;
    case "not_installed":
    case "repository_missing":
      return <>Connected as {value.login}. Finish the steps below to publish.</>;
    case "ready":
      return <SiteSummary site={value.site} />;
    case "error":
      return <>{failureText(value.error)}</>;
  }
}

function SiteSummary({ site }: { site: SiteInfoView }) {
  return (
    <>
      Publishes to{" "}
      <ExternalLink href={`https://github.com/${site.repository}`}>{site.repository}</ExternalLink> (gh-pages branch), shown at{" "}
      {site.siteUrl}.
      {site.private ? " The repository is private: GitHub Pages for private repositories needs a paid GitHub plan." : null}
    </>
  );
}

function PublishActions({
  site,
  publicCopy,
  onReload,
}: {
  site: SiteLoad;
  publicCopy: ReturnType<typeof buildPublicSnapshot>;
  onReload: () => void;
}) {
  if (site.phase === "loaded" && site.value.state === "not_linked") {
    return (
      <Button asChild variant="primary">
        <a href={CONNECT_PATH}>
          <Plug aria-hidden="true" size={16} strokeWidth={1.75} />
          Connect GitHub
        </a>
      </Button>
    );
  }
  if (site.phase === "loaded" && site.value.state === "ready" && publicCopy.ok) {
    return <PublishDialog site={site.value.site} publicCopy={publicCopy.value} onSiteChanged={onReload} />;
  }
  const retry = site.phase === "failed" || (site.phase === "loaded" && site.value.state === "error");
  return (
    <div className="flex flex-wrap gap-2">
      {retry ? (
        <Button variant="secondary" onClick={onReload}>
          <RefreshCw aria-hidden="true" size={16} strokeWidth={1.75} />
          Check again
        </Button>
      ) : null}
      <Button variant="secondary" disabled aria-describedby="publish-help">
        <Globe aria-hidden="true" size={16} strokeWidth={1.75} />
        Publish
      </Button>
    </div>
  );
}

function SetupSteps({ site, onReload }: { site: SiteLoad; onReload: () => void }) {
  if (site.phase !== "loaded") return null;
  const value = site.value;
  if (value.state !== "not_installed" && value.state !== "repository_missing" && value.state !== "ready") return null;
  if (value.state === "ready") return <DisconnectRow login={value.site.login} />;

  const repositoryName = `${value.login}.github.io`;
  const createUrl =
    value.state === "repository_missing"
      ? value.createUrl
      : `https://github.com/new?name=${encodeURIComponent(repositoryName)}&visibility=public`;
  return (
    <div className="flex flex-col gap-3 border-t border-border pt-3">
      <p className="text-label font-semibold">Set up your site on GitHub</p>
      <ol className="list-decimal pl-5 text-body text-foreground-secondary">
        <li>
          <ExternalLink href={createUrl}>Create a public repository named {repositoryName}</ExternalLink>. Tick “Add a README file”
          so it isn&apos;t empty.
        </li>
        <li>
          <ExternalLink href={value.installUrl}>Install Updater&apos;s GitHub App</ExternalLink> and choose “Only select repositories”
          → {repositoryName}. Updater can then write to that repository only.
        </li>
        <li>Come back and choose “Check again”.</li>
      </ol>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={onReload}>
          <RefreshCw aria-hidden="true" size={16} strokeWidth={1.75} />
          Check again
        </Button>
        <DisconnectButton login={value.login} />
      </div>
    </div>
  );
}

function DisconnectRow({ login }: { login: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
      <p className="text-support text-muted">
        Connected to GitHub as {login}. Your site and its history stay in your repository.
      </p>
      <DisconnectButton login={login} />
    </div>
  );
}

function DisconnectButton({ login }: { login: string }) {
  const [open, setOpen] = useState(false);
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={setOpen}
      trigger={
        <Button variant="ghost" size="sm">
          Disconnect GitHub
        </Button>
      }
      title="Disconnect GitHub?"
      description={
        <div className="flex flex-col gap-2">
          <p>Updater forgets that this browser is connected to {login}. Your published site stays online and stays yours.</p>
          <p>
            To remove Updater&apos;s access completely, uninstall the app on GitHub: Settings → Applications → Installed GitHub
            Apps.
          </p>
        </div>
      }
      confirmLabel="Disconnect"
      onConfirm={async () => {
        const outcome = await requestDisconnect();
        if (!outcome.ok) throw new Error(outcome.error.message);
        window.location.reload();
      }}
    />
  );
}
