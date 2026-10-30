"use client";

import { CircleAlert, CircleCheck, HardDrive } from "lucide-react";
import { formatTime } from "@/lib/utils/dates";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useAccount } from "@/components/account/account-provider";
import { saveFailureToast, useOptionalWorkspaceStore, useWorkspaceSnapshot } from "./workspace-provider";

/**
 * Save status (design.md §5): "Saved locally · 14:02", or "Not saved" with
 * the reason and a retry. Reflects the adapter's real result only.
 */
export function SaveStatus({ compact = false }: { compact?: boolean }) {
  const snapshot = useWorkspaceSnapshot();
  const store = useOptionalWorkspaceStore();
  const { snapshot: account } = useAccount();
  const { notify } = useToast();

  if (!store && account.phase === "ready" && account.state.status !== "signed_in") {
    return <StatusLine icon="drive" text="No workspace open" />;
  }
  if (!store || snapshot.phase === "loading") {
    return <StatusLine icon="drive" text="Loading workspace…" />;
  }
  if (snapshot.phase === "recovery") {
    return <StatusLine icon="error" text="Saved data couldn't be read" />;
  }
  const { save } = snapshot;
  if (save.state === "error") {
    return (
      <div className="flex flex-col items-start gap-1.5" role="status">
        <StatusLine icon="error" text={`Not saved: ${save.error.message}`} live={false} />
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            const outcome = store.retrySave();
            if (outcome.ok) notify({ tone: "success", title: "Saved", description: "Your workspace is saved in this browser." });
            else notify(saveFailureToast(outcome.error.message));
          }}
        >
          Retry save
        </Button>
      </div>
    );
  }
  if (save.state === "saved") {
    return <StatusLine icon="saved" text={`Saved locally · ${formatTime(save.savedAt)}`} />;
  }
  return <StatusLine icon="drive" text={compact ? "Stored in this browser" : "Data stored in this browser"} />;
}

function StatusLine({ icon, text, live = true }: { icon: "drive" | "saved" | "error"; text: string; live?: boolean }) {
  const Icon = icon === "error" ? CircleAlert : icon === "saved" ? CircleCheck : HardDrive;
  return (
    <p
      role={live ? "status" : undefined}
      className={cn("flex items-start gap-2 text-meta font-medium", icon === "error" ? "text-error" : "text-muted")}
    >
      <Icon aria-hidden="true" size={16} strokeWidth={1.75} className="shrink-0" />
      <span>{text}</span>
    </p>
  );
}
