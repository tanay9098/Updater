"use client";

import { useState } from "react";
import { Globe } from "lucide-react";
import { requestPublish, type ClientFailure, type SiteInfoView } from "@/lib/publishers/github-pages/contract";
import type { PublishConfirmations } from "@/lib/validation/publication";
import { isSparse, type PublicSnapshot } from "@/features/publishing/snapshot";
import { startPublishing } from "@/features/publishing/state";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { useWorkspaceAction } from "@/components/workspace/workspace-provider";

function plural(count: number, one: string, many = `${one}s`) {
  return `${count} ${count === 1 ? one : many}`;
}

/**
 * "Publish" with its confirmation (T10.9, rules.md §7.2.1). States what
 * becomes public, where, and what Updater changes in the repository. If
 * the repository needs a change the developer hasn't agreed to, the server
 * refuses and the dialog asks for that specific confirmation.
 */
export function PublishDialog({
  site,
  publicCopy,
  onSiteChanged,
}: {
  site: SiteInfoView;
  publicCopy: PublicSnapshot;
  onSiteChanged: () => void;
}) {
  const run = useWorkspaceAction();
  const { notify } = useToast();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<ClientFailure | null>(null);
  const [needsReplace, setNeedsReplace] = useState(false);
  const [needsSwitch, setNeedsSwitch] = useState(false);

  const { portfolio } = publicCopy;
  const switching = site.pages.state === "serving_other" || needsSwitch;
  const confirmations: PublishConfirmations = {
    ...(needsReplace ? { replaceBranch: true } : {}),
    ...(switching ? { switchPagesSource: true } : {}),
  };

  function changeOpen(next: boolean) {
    if (pending) return;
    if (next) {
      setFailure(null);
      setNeedsReplace(false);
      setNeedsSwitch(false);
    }
    setOpen(next);
  }

  async function publish(confirm: PublishConfirmations) {
    setPending(true);
    setFailure(null);
    const outcome = await requestPublish({ portfolio, confirm });
    setPending(false);
    if (!outcome.ok) return setFailure(outcome.error);
    if (!outcome.value.ok) {
      const error = outcome.value.error;
      // The repository needs a change the developer hasn't agreed to yet: ask for exactly that.
      if (error.code === "branch_in_use") setNeedsReplace(true);
      if (error.code === "pages_source_conflict") setNeedsSwitch(true);
      return setFailure(error);
    }
    const result = outcome.value.value;
    const recorded = run(
      (ws, now) => startPublishing(ws, { repository: result.repository, commitSha: result.commitSha, contentHash: publicCopy.contentHash }, now),
      { announceRefusal: true },
    );
    setOpen(false);
    if (recorded.ok || recorded.applied) {
      notify(
        result.pagesSetup === "manual"
          ? {
              tone: "warning",
              title: "Committed. Turn on GitHub Pages",
              description: `Your site is in ${result.repository}, but GitHub didn't let Updater turn on Pages. In the repository's Pages settings, choose Deploy from a branch → gh-pages → / (root).`,
            }
          : { tone: "info", title: "Committed to GitHub", description: "GitHub Pages is building your site. This page updates when it's live." },
      );
    }
    if (result.pagesSetup === "ready" && switching) onSiteChanged();
  }

  const counts = [
    plural(portfolio.profile.links.length, "link"),
    plural(portfolio.skills.length, "skill"),
    plural(portfolio.projects.length, "project"),
    plural(portfolio.achievements.length, "other achievement"),
  ].join(", ");

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>
        <Button variant="primary">
          <Globe aria-hidden="true" size={16} strokeWidth={1.75} />
          Publish
        </Button>
      </DialogTrigger>
      <DialogContent title="Publish your portfolio?" description={`Anyone with the address can see it: ${site.siteUrl}`}>
        <div className="flex flex-col gap-3 text-body text-foreground-secondary">
          <p>
            Updater publishes your <strong className="font-semibold text-foreground">saved draft</strong>, as the preview shows it:
            your name{portfolio.profile.headline ? ", headline" : ""}
            {portfolio.profile.location ? ", location" : ""}
            {portfolio.profile.intro ? ", introduction" : ""}, {counts}. Your email address isn&apos;t published.
          </p>
          <p>
            It commits the site to the <code className="font-mono text-support">gh-pages</code> branch of {site.repository} and
            changes nothing else in your GitHub account. The site and its history stay yours.
          </p>
          {publicCopy.leftOutDemo > 0 ? (
            <Alert tone="info" title="Demo data is left out">
              {plural(publicCopy.leftOutDemo, "demo item")} won&apos;t be published. Demo data is fictional.
            </Alert>
          ) : null}
          {isSparse(portfolio) ? (
            <Alert tone="warning" title="Only your name will be on the page">
              Add a headline, links, or projects first if you want more on it.
            </Alert>
          ) : null}
          {site.pages.state === "serving_other" ? (
            <Alert tone="warning" title="GitHub Pages will switch to Updater's branch">
              It currently publishes {site.pages.source}. Publishing switches it to the gh-pages branch. Your other branches aren&apos;t
              changed, and you can switch back in the repository&apos;s Pages settings.
            </Alert>
          ) : null}
          {failure ? (
            <Alert
              tone={failure.code === "branch_in_use" || failure.code === "pages_source_conflict" ? "warning" : "error"}
              title={
                failure.code === "branch_in_use"
                  ? "Replace the gh-pages branch?"
                  : failure.code === "pages_source_conflict"
                    ? "Switch GitHub Pages to Updater's branch?"
                    : "Not published"
              }
            >
              {failure.resetAt ? `${failure.message} Try again later.` : failure.message}
            </Alert>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="primary" loading={pending} onClick={() => void publish(confirmations)}>
            {needsReplace ? "Replace and publish" : switching ? "Switch and publish" : "Publish"}
          </Button>
          <DialogClose asChild>
            <Button variant="secondary" disabled={pending}>
              Cancel
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
