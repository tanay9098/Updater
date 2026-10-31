"use client";

import { useRef, useState, type FormEvent } from "react";
import { Download, RefreshCw } from "lucide-react";
import { parseGithubUsername } from "@/lib/providers/github/repositories";
import {
  requestGithubRepositories,
  type ParsedListing,
  type RequestFailure,
} from "@/lib/providers/github/contract";
import { formatDate, formatDateTime, formatTime } from "@/lib/utils/dates";
import {
  failureToRecord,
  findGithubSource,
  importGithubRepositories,
  importedGithubIds,
  recordGithubFailure,
  removeGithubSource,
  summarizeGithubData,
} from "@/features/sources/github";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup } from "@/components/ui/radio-group";
import { useWorkspace, useWorkspaceAction, useWorkspaceStore } from "@/components/workspace/workspace-provider";

function plural(count: number, one: string, many = `${one}s`) {
  return `${count} ${count === 1 ? one : many}`;
}

/** A failure as shown to the user, with the time requests may resume when GitHub said so. */
export function failureMessage(error: RequestFailure): string {
  return error.resetAt ? `${error.message} Try again after ${formatTime(error.resetAt)}.` : error.message;
}

type Phase = { name: "enter" } | { name: "loading" } | { name: "choose"; listing: ParsedListing };

/**
 * "Import from GitHub" (T10.1, design.md §9). Asks Updater's server for the
 * account's public repositories, shows what was found, and imports only the
 * repositories the user selects. Already-imported repositories in the
 * listing are refreshed (D-024: their evidence and proposals stay).
 */
export function GithubImportDialog() {
  const ws = useWorkspace();
  const store = useWorkspaceStore();
  const run = useWorkspaceAction();
  const source = findGithubSource(ws);
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [failure, setFailure] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>({ name: "enter" });
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const imported = importedGithubIds(ws);
  // Only the latest request may update the dialog (it can be closed and reopened while one is in flight).
  const latestRequest = useRef(0);

  async function find(name: string) {
    const requestId = ++latestRequest.current;
    setFailure(null);
    setPhase({ name: "loading" });
    const outcome = await requestGithubRepositories(name);
    if (requestId !== latestRequest.current) return;
    if (outcome.ok) {
      setSelected(new Set());
      setPhase({ name: "choose", listing: outcome.value });
      return;
    }
    const message = failureMessage(outcome.error);
    setFailure(message);
    setPhase({ name: "enter" });
    // A failed check on an existing source is recorded on it (rules.md §7.5.4). Read the store fresh: the dialog may be stale.
    const outcomeToRecord = failureToRecord(outcome.error.code);
    const current = store.getSnapshot();
    if (outcomeToRecord && current.phase === "ready" && findGithubSource(current.workspace)) {
      run((latest, now) => recordGithubFailure(latest, { outcome: outcomeToRecord, message }, now));
    }
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      latestRequest.current += 1;
      return;
    }
    setFailure(null);
    setFieldError(undefined);
    setSelected(new Set());
    setPhase({ name: "enter" });
    if (source?.accountLabel) {
      setUsername(source.accountLabel);
      void find(source.accountLabel);
    } else {
      setUsername("");
    }
  }

  function submitUsername(event: FormEvent) {
    event.preventDefault();
    const parsed = parseGithubUsername(username);
    if (!parsed.ok) {
      setFieldError(parsed.message);
      return;
    }
    setFieldError(undefined);
    void find(parsed.username);
  }

  function importSelected(listing: ParsedListing) {
    const outcome = run(
      (current, now) =>
        importGithubRepositories(
          current,
          {
            login: listing.login,
            repositories: listing.repositories.map((candidate) => candidate.item),
            selectedExternalIds: Array.from(selected),
          },
          now,
        ),
      {
        success: (value) => ({
          title: value.added > 0 ? `Imported ${plural(value.added, "repository", "repositories")}` : "GitHub data refreshed",
          description: [
            value.proposals > 0 ? `${plural(value.proposals, "proposal")} ${value.proposals === 1 ? "is" : "are"} waiting in the Review Queue.` : null,
            value.updated > 0 ? `${plural(value.updated, "imported repository", "imported repositories")} refreshed.` : null,
            value.rejected.length > 0 ? `${plural(value.rejected.length, "repository", "repositories")} skipped: invalid data.` : null,
          ]
            .filter(Boolean)
            .join(" "),
        }),
      },
    );
    if (outcome.ok || outcome.applied) {
      setOpen(false);
      return;
    }
    setFailure(outcome.error.message);
  }

  const listing = phase.name === "choose" ? phase.listing : null;
  const newRepositories = listing?.repositories.filter((candidate) => !imported.has(candidate.item.externalId)) ?? [];
  const refreshCount = listing ? listing.repositories.length - newRepositories.length : 0;
  const selectedCount = newRepositories.filter((candidate) => selected.has(candidate.item.externalId)).length;
  const canImport = selectedCount > 0 || (Boolean(source) && refreshCount > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant={source ? "secondary" : "primary"} size="sm">
          {source ? (
            <RefreshCw aria-hidden="true" size={16} strokeWidth={1.75} />
          ) : (
            <Download aria-hidden="true" size={16} strokeWidth={1.75} />
          )}
          {source ? "Check for updates" : "Import repositories"}
        </Button>
      </DialogTrigger>
      <DialogContent
        title={source ? `Check @${source.accountLabel ?? "GitHub"} for updates` : "Import from GitHub"}
        description="Reads public repositories through GitHub's public API. Nothing is written to GitHub, and nothing is imported until you choose."
      >
        <div className="flex flex-col gap-4">
          {failure ? (
            <Alert tone="error" title="Nothing was imported">
              {failure}
            </Alert>
          ) : null}

          {source ? null : (
            <form noValidate onSubmit={submitUsername} className="flex flex-col gap-3">
              <Field
                label="GitHub username"
                required
                error={fieldError}
                hint="A user or organization. Updater can't confirm the account is yours, so import only your own work."
              >
                <Input
                  value={username}
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={40}
                  onChange={(event) => setUsername(event.target.value)}
                />
              </Field>
              <div>
                <Button type="submit" variant={listing ? "secondary" : "primary"} loading={phase.name === "loading"}>
                  Find repositories
                </Button>
              </div>
            </form>
          )}

          {source && phase.name === "loading" ? (
            <p role="status" className="text-body text-foreground-secondary">
              Checking GitHub for public repositories…
            </p>
          ) : null}
          {source && phase.name === "enter" && failure ? (
            <div>
              <Button variant="secondary" onClick={() => void find(source.accountLabel ?? "")}>
                Try again
              </Button>
            </div>
          ) : null}

          {listing ? (
            <RepositoryChoices
              listing={listing}
              imported={imported}
              selected={selected}
              onSelectedChange={setSelected}
            />
          ) : null}

          <DialogFooter>
            {listing ? (
              <Button variant="primary" disabled={!canImport} onClick={() => importSelected(listing)}>
                {selectedCount > 0
                  ? `Import ${plural(selectedCount, "repository", "repositories")}`
                  : source
                    ? "Refresh imported repositories"
                    : "Import repositories"}
              </Button>
            ) : null}
            <DialogClose asChild>
              <Button variant="secondary">Cancel</Button>
            </DialogClose>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RepositoryChoices({
  listing,
  imported,
  selected,
  onSelectedChange,
}: {
  listing: ParsedListing;
  imported: Set<string>;
  selected: Set<string>;
  onSelectedChange: (next: Set<string>) => void;
}) {
  const candidates = listing.repositories;
  const newIds = candidates.map((candidate) => candidate.item.externalId).filter((id) => !imported.has(id));
  const notes = [
    listing.skipped.forks > 0 ? `${plural(listing.skipped.forks, "fork")} left out.` : null,
    listing.skipped.invalid > 0 ? `${plural(listing.skipped.invalid, "repository", "repositories")} skipped: GitHub sent incomplete data.` : null,
    listing.truncated ? `Only the ${candidates.length} most recently pushed repositories are listed.` : null,
  ].filter(Boolean);

  return (
    <section aria-label="Repositories found" className="flex flex-col gap-3">
      <p role="status" className="text-body text-foreground-secondary">
        {candidates.length === 0
          ? `@${listing.login} has no public repositories of their own to import.`
          : `Found ${plural(candidates.length, "public repository", "public repositories")} owned by @${listing.login}${
              newIds.length < candidates.length ? `, ${candidates.length - newIds.length} already imported` : ""
            }.`}
      </p>
      {notes.length > 0 ? <p className="text-support text-muted">{notes.join(" ")}</p> : null}
      {newIds.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => onSelectedChange(new Set(newIds))}>
            Select all new
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onSelectedChange(new Set())} disabled={selected.size === 0}>
            Clear selection
          </Button>
        </div>
      ) : null}
      {candidates.length > 0 ? (
        <ul className="flex max-h-72 flex-col gap-3 overflow-y-auto rounded-sm border border-border p-3">
          {candidates.map(({ item, pushedAt }) => {
            const isImported = imported.has(item.externalId);
            const description = typeof item.metadata?.description === "string" ? item.metadata.description : null;
            const language = typeof item.metadata?.language === "string" ? item.metadata.language : null;
            const details = [
              isImported ? "Already imported; will be refreshed." : null,
              description,
              language,
              item.metadata?.archived === true ? "Archived" : null,
              pushedAt ? `Last pushed ${formatDate(pushedAt)}` : null,
            ].filter(Boolean);
            return (
              <li key={item.externalId}>
                <Checkbox
                  label={item.title}
                  hint={details.join(" · ")}
                  checked={isImported || selected.has(item.externalId)}
                  disabled={isImported}
                  onCheckedChange={(checked) => {
                    const next = new Set(selected);
                    if (checked === true) next.add(item.externalId);
                    else next.delete(item.externalId);
                    onSelectedChange(next);
                  }}
                />
              </li>
            );
          })}
        </ul>
      ) : null}
      {listing.rateLimit ? (
        <p className="text-meta font-medium text-muted">
          GitHub requests left for this server: {listing.rateLimit.remaining} of {listing.rateLimit.limit}, resets at{" "}
          {formatTime(listing.rateLimit.resetAt)}.
        </p>
      ) : null}
    </section>
  );
}

/** Account, last import, and the last failure, from what the source recorded. */
export function GithubSourceStatus() {
  const ws = useWorkspace();
  const source = findGithubSource(ws);
  if (!source) return null;
  const last = source.lastSync;
  return (
    <div className="flex flex-col gap-2 border-t border-border px-4 py-3 sm:px-5">
      <p className="text-support text-foreground-secondary">
        Importing public data for <span className="font-medium text-foreground">@{source.accountLabel}</span>. Updater
        can&apos;t confirm this account is yours.
      </p>
      {last && last.outcome !== "succeeded" ? (
        <Alert tone="warning" title={last.outcome === "rate_limited" ? "GitHub's rate limit was reached" : "The last check failed"}>
          <time dateTime={last.attemptedAt}>{formatDateTime(last.attemptedAt)}</time>: {last.message} Previously imported
          repositories are unchanged.
        </Alert>
      ) : last ? (
        <p className="text-meta font-medium text-muted">
          Last imported <time dateTime={last.attemptedAt}>{formatDateTime(last.attemptedAt)}</time>: {last.message}
        </p>
      ) : null}
    </div>
  );
}

/**
 * "Remove GitHub data" with a confirmation that states what is lost and a
 * choice to keep approved content (rules.md §7.2.5).
 */
export function RemoveGithubSourceButton() {
  const ws = useWorkspace();
  const run = useWorkspaceAction();
  const [keep, setKeep] = useState<"remove" | "keep">("keep");
  const summary = summarizeGithubData(ws);
  if (!summary) return null;
  const approved = summary.claims + summary.projects + summary.skills;

  return (
    <ConfirmDialog
      trigger={
        <Button variant="secondary" size="sm">
          Remove GitHub data
        </Button>
      }
      onOpenChange={(open) => {
        if (open) setKeep("keep");
      }}
      title="Remove GitHub data?"
      description={
        <div className="flex flex-col gap-3">
          <p>
            This deletes the GitHub source with {plural(summary.sourceItems, "repository", "repositories")},{" "}
            {plural(summary.evidence, "evidence record")}, and {plural(summary.reviewItems, "proposal")} from this
            workspace. Nothing on GitHub changes.
          </p>
          {approved > 0 ? (
            <RadioGroup
              legend={`You approved ${plural(approved, "project, achievement, or skill", "projects, achievements, or skills")} based only on this GitHub data.`}
              value={keep}
              onValueChange={setKeep}
              options={[
                {
                  value: "keep",
                  label: "Keep them in the portfolio",
                  hint: "They are marked “source removed” and lose their evidence links.",
                },
                { value: "remove", label: "Remove them too" },
              ]}
            />
          ) : null}
        </div>
      }
      confirmLabel="Remove GitHub data"
      destructive
      onConfirm={() => {
        const outcome = run((current, now) => removeGithubSource(current, { keepApprovedContent: keep === "keep" }, now), {
          success: { title: "GitHub data removed" },
        });
        if (!outcome.ok && !outcome.applied) throw new Error(outcome.error.message);
      }}
    />
  );
}
