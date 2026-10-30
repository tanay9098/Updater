"use client";

import { useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Download, RotateCcw, Upload } from "lucide-react";
import { restartOnboarding } from "@/features/onboarding/onboarding";
import {
  exportFileName,
  exportWorkspace,
  importWorkspace,
  type ImportErrorDetail,
  type ParsedWorkspace,
} from "@/features/workspace/transfer";
import { hasDemoData } from "@/features/workspace/workspace";
import type { Workspace } from "@/types/domain";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { downloadText } from "@/components/workspace/download";
import { RemoveDemoDataButton } from "@/components/sources/demo-data-controls";
import { saveFailureToast, useWorkspace, useWorkspaceAction, useWorkspaceStore } from "@/components/workspace/workspace-provider";

const MAX_IMPORT_BYTES = 4_000_000;

/** A plain-language list of what a workspace holds, for confirmations. */
export function counts(ws: Workspace): string {
  const parts = [
    ws.profile ? "your profile" : null,
    `${ws.sourceItems.length} source items`,
    `${ws.evidence.length} evidence records`,
    `${ws.reviewItems.length} proposals`,
    `${ws.portfolio.projects.length} projects`,
    `${ws.portfolio.claims.length} achievements`,
    `${ws.portfolio.skills.length} skills`,
    `${ws.resumes.length} resumes`,
  ].filter(Boolean);
  return parts.join(", ");
}

/** Settings → Data (design.md §13, FR-DATA-04, FR-SET-02). */
export function DataSettings() {
  const ws = useWorkspace();
  const store = useWorkspaceStore();
  const run = useWorkspaceAction();
  const router = useRouter();
  const { notify } = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [importErrors, setImportErrors] = useState<{ message: string; details: ImportErrorDetail[] } | null>(null);
  const [pendingImport, setPendingImport] = useState<{ fileName: string; parsed: ParsedWorkspace } | null>(null);

  function exportJson() {
    const now = new Date().toISOString();
    downloadText(exportFileName(now), exportWorkspace(ws));
    notify({ tone: "info", title: "Export started", description: "Your browser is saving the file. Nothing was sent anywhere." });
  }

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    setImportErrors(null);
    if (!file) return;
    if (file.size > MAX_IMPORT_BYTES) {
      setImportErrors({ message: "The file is too large to be an Updater workspace.", details: [] });
      return;
    }
    let text: string;
    try {
      text = await file.text();
    } catch {
      setImportErrors({ message: "The file couldn't be read.", details: [] });
      return;
    }
    const parsed = importWorkspace(text, new Date().toISOString());
    if (!parsed.ok) {
      setImportErrors({ message: parsed.error.message, details: parsed.details ?? [] });
      return;
    }
    setPendingImport({ fileName: file.name, parsed: parsed.value });
  }

  return (
    <div className="flex flex-col divide-y divide-border">
      <DataRow
        title="Export workspace (JSON)"
        description="Downloads everything Updater stores for you in this browser. Keep it as a backup."
        action={
          <Button variant="secondary" size="sm" onClick={exportJson}>
            <Download aria-hidden="true" size={16} strokeWidth={1.75} />
            Export JSON
          </Button>
        }
      />
      <DataRow
        title="Import workspace"
        description="Replaces this browser's workspace with an exported file. The file is checked first; if it isn't valid, nothing changes."
        action={
          <>
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(event) => void onFile(event)}
            />
            <Button variant="secondary" size="sm" onClick={() => fileInput.current?.click()}>
              <Upload aria-hidden="true" size={16} strokeWidth={1.75} />
              Choose file…
            </Button>
          </>
        }
      >
        {importErrors ? (
          <Alert tone="error" title="Import failed. Nothing was changed.">
            <p>{importErrors.message}</p>
            {importErrors.details.length > 0 ? (
              <ul className="mt-1 list-disc pl-5 font-mono text-code break-all">
                {importErrors.details.map((detail) => (
                  <li key={`${detail.path}-${detail.message}`}>
                    {detail.path}: {detail.message}
                  </li>
                ))}
              </ul>
            ) : null}
          </Alert>
        ) : null}
      </DataRow>
      <ConfirmDialog
        open={pendingImport !== null}
        onOpenChange={(open) => {
          if (!open) setPendingImport(null);
        }}
        title="Replace workspace?"
        description={
          pendingImport ? (
            <>
              <p>
                “{pendingImport.fileName}” is valid. Importing it permanently replaces what is stored now: {counts(ws)}.
              </p>
              <p className="mt-2">It contains: {counts(pendingImport.parsed.workspace)}. Export first if you want a backup.</p>
            </>
          ) : (
            ""
          )
        }
        confirmLabel="Replace workspace"
        destructive
        onConfirm={() => {
          if (!pendingImport) return;
          const outcome = store.replace(pendingImport.parsed.workspace, pendingImport.parsed.notices);
          if (outcome.ok) notify({ tone: "success", title: "Workspace imported" });
          else notify(saveFailureToast(outcome.error.message));
          setPendingImport(null);
        }}
      />
      <DataRow
        title="Remove demo data"
        description={
          hasDemoData(ws)
            ? "Deletes the fictional demo items, their evidence, and proposals. You choose whether approved demo content stays."
            : "No demo data is loaded."
        }
        action={<RemoveDemoDataButton />}
      />
      <DataRow
        title="Restart onboarding"
        description="Walk through the setup steps again. Your data is kept."
        action={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              const outcome = run((current) => restartOnboarding(current));
              if (outcome.ok || outcome.applied) router.push("/onboarding");
            }}
          >
            <RotateCcw aria-hidden="true" size={16} strokeWidth={1.75} />
            Restart onboarding
          </Button>
        }
      />
      <DataRow
        title="Reset workspace"
        description="Deletes your workspace stored in this browser. Your theme is kept."
        action={
          <ConfirmDialog
            trigger={
              <Button variant="secondary" size="sm">
                Reset workspace…
              </Button>
            }
            title="Reset workspace?"
            description={
              <>
                <p>This permanently deletes {counts(ws)}, and your activity history.</p>
                <p className="mt-2">It can&apos;t be undone. Export your workspace first if you might need it.</p>
              </>
            }
            confirmLabel="Reset workspace"
            destructive
            onConfirm={() => {
              const outcome = store.reset();
              if (!outcome.ok) throw new Error(outcome.error.message);
              notify({ tone: "success", title: "Workspace reset", description: "Everything stored for you was deleted." });
            }}
          />
        }
      />
    </div>
  );
}

function DataRow({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description: string;
  action: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-label font-semibold">{title}</h3>
          <p className="text-support text-foreground-secondary">{description}</p>
        </div>
        <div className="shrink-0">{action}</div>
      </div>
      {children}
    </div>
  );
}
