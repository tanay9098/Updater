"use client";

import { Fragment, type ReactNode } from "react";
import { Download } from "lucide-react";
import { AccountRequired } from "@/components/account/account-required";
import { useAccount } from "@/components/account/account-provider";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { LoadingState, Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { downloadText } from "./download";
import { useWorkspaceScopeKey, useWorkspaceSnapshot, useWorkspaceStore } from "./workspace-provider";

/**
 * Renders its children once the workspace is loaded. Shows skeletons while
 * it hydrates and a recovery screen when the stored data can't be read
 * (FR-DATA-02): export the raw data, or reset.
 *
 * With sign-in configured, nothing opens until the server confirms the
 * account; signed out, it explains how to sign in instead (D-030). The
 * children are keyed by account, so no form state carries over when the
 * account changes.
 */
export function WorkspaceGate({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  const { snapshot: account } = useAccount();
  const scope = useWorkspaceScopeKey();
  const snapshot = useWorkspaceSnapshot();
  if (account.phase === "error") return <AccountRequired reason="error" message={account.message} />;
  if (account.phase === "ready" && account.state.status === "signed_out") return <AccountRequired reason="signed_out" />;
  if (account.phase === "ready" && account.state.status === "unavailable") return <AccountRequired reason="unavailable" />;
  if (snapshot.phase === "loading") return <>{fallback ?? <PageSkeleton />}</>;
  if (snapshot.phase === "recovery") return <RecoveryScreen message={snapshot.error.message} />;
  return (
    <>
      {snapshot.notices.length > 0 ? (
        <Alert tone="info" title="Some saved selections were updated" className="mb-6">
          <ul className="list-disc pl-5">
            {snapshot.notices.map((notice) => (
              <li key={notice}>{notice}</li>
            ))}
          </ul>
        </Alert>
      ) : null}
      <Fragment key={scope ?? "injected"}>{children}</Fragment>
    </>
  );
}

export function PageSkeleton() {
  return (
    <LoadingState label="Loading your workspace…" className="flex flex-col gap-4">
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-40 w-full" />
    </LoadingState>
  );
}

function RecoveryScreen({ message }: { message: string }) {
  const store = useWorkspaceStore();
  const { notify } = useToast();

  function exportRaw() {
    const raw = store.readRecovery();
    if (raw === null) {
      notify({ tone: "error", title: "Nothing to export", description: "The stored data couldn't be read from this browser." });
      return;
    }
    downloadText(`updater-recovery-${new Date().toISOString().slice(0, 10)}.json`, raw);
  }

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <Alert tone="error" title="Your saved workspace couldn't be loaded">
        <p>{message}</p>
        <p className="mt-2">
          Nothing has been deleted. Export the raw data to keep a copy, then reset to start with an empty workspace.
        </p>
      </Alert>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button variant="secondary" onClick={exportRaw}>
          <Download aria-hidden="true" size={16} strokeWidth={1.75} />
          Export raw data
        </Button>
        <ConfirmDialog
          trigger={<Button variant="secondary">Reset workspace</Button>}
          title="Reset workspace?"
          description="This permanently deletes the unreadable workspace data stored in this browser. Export the raw data first if you might need it."
          confirmLabel="Reset workspace"
          destructive
          onConfirm={() => {
            const outcome = store.reset();
            if (!outcome.ok) throw new Error(outcome.error.message);
            notify({ tone: "success", title: "Workspace reset", description: "You're starting with an empty workspace." });
          }}
        />
      </div>
    </div>
  );
}
