"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { legacyBrowserWorkspaceStorage, type WorkspaceStorage } from "@/lib/data/storage";
import type { Workspace } from "@/types/domain";
import { useAccount } from "@/components/account/account-provider";
import { useSignOut } from "@/components/account/use-sign-out";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { saveFailureToast, useWorkspace, useWorkspaceStore } from "@/components/workspace/workspace-provider";
import { counts } from "./data-settings";

/** Settings → Account (design.md §13, D-030, D-031). Only rendered inside the gate, so an account is signed in. */
export function AccountSettings({ localStorage }: { localStorage?: WorkspaceStorage }) {
  const { snapshot } = useAccount();
  const { signOut, pending } = useSignOut();

  if (snapshot.phase !== "ready" || snapshot.state.status !== "signed_in") return null;

  const { user } = snapshot.state;
  return (
    <div className="flex flex-col divide-y divide-border">
      <div className="flex flex-col gap-3 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 className="text-label font-semibold">Signed in with Google</h3>
          <p className="text-support break-words text-foreground-secondary">
            {[user.name, user.email].filter(Boolean).join(" · ") || "Your Google account"}
          </p>
          <p className="text-support text-foreground-secondary">
            Your portfolio, resumes, and everything else here belong to this account. Another Google account opens its
            own, separate workspace.
          </p>
        </div>
        <Button variant="secondary" size="sm" loading={pending} onClick={() => void signOut()} className="self-start">
          <LogOut aria-hidden="true" size={16} strokeWidth={1.75} />
          Sign out
        </Button>
      </div>
      <LocalWorkspaceClaim storage={localStorage} />
    </div>
  );
}

/**
 * A workspace saved before sign-in became compulsory has no owner. It is never
 * opened automatically; the signed-in user can move it into their account,
 * which removes the unscoped copy so no other account can take it.
 */
function LocalWorkspaceClaim({ storage: injected }: { storage?: WorkspaceStorage }) {
  const ws = useWorkspace();
  const store = useWorkspaceStore();
  const { notify } = useToast();
  const [storage] = useState(() => injected ?? legacyBrowserWorkspaceStorage());
  const [local, setLocal] = useState<{ workspace: Workspace; notices: string[] } | null>(() => {
    const loaded = storage.load();
    return loaded.ok && loaded.value.workspace ? { workspace: loaded.value.workspace, notices: loaded.value.notices } : null;
  });

  if (!local) return null;

  return (
    <div className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex flex-col gap-0.5">
        <h3 className="text-label font-semibold">Workspace saved before sign-in</h3>
        <p className="text-support text-foreground-secondary">
          This browser has a workspace from before sign-in was required. It doesn&apos;t belong to any account yet:{" "}
          {counts(local.workspace)}.
        </p>
      </div>
      <ConfirmDialog
        trigger={
          <Button variant="secondary" size="sm" className="self-start">
            Move into this account…
          </Button>
        }
        title="Move workspace into this account?"
        description={
          <>
            <p>It contains: {counts(local.workspace)}.</p>
            <p className="mt-2">
              It permanently replaces what this account has now: {counts(ws)}. Export first if you want a backup.
            </p>
            <p className="mt-2">The copy without an account is then removed from this browser.</p>
          </>
        }
        confirmLabel="Move workspace"
        destructive
        onConfirm={() => {
          const outcome = store.replace(local.workspace, local.notices);
          if (!outcome.ok) {
            // Not saved under the account, so the original copy is kept.
            notify(saveFailureToast(outcome.error.message));
            return;
          }
          const cleared = storage.clear();
          setLocal(null);
          notify(
            cleared.ok
              ? { tone: "success", title: "Workspace moved into your account" }
              : {
                  tone: "warning",
                  title: "Workspace moved, but the old copy remains",
                  description: `${cleared.error.message} Clearing this site's data in your browser removes it.`,
                },
          );
        }}
      />
    </div>
  );
}
