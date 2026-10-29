"use client";

import { useState } from "react";
import { FlaskConical } from "lucide-react";
import { loadDemoWorkspace, removeDemoData, summarizeDemoData } from "@/features/sources/demo";
import { hasDemoData } from "@/features/workspace/workspace";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { RadioGroup } from "@/components/ui/radio-group";
import { useWorkspace, useWorkspaceAction } from "@/components/workspace/workspace-provider";

/** "Load demo data" (explicit choice only, PRD §11). */
export function LoadDemoButton({ onLoaded }: { onLoaded?: () => void }) {
  const run = useWorkspaceAction();
  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={() => {
        const outcome = run((ws, now) => loadDemoWorkspace(ws, now), {
          announceRefusal: true,
          success: {
            title: "Demo data loaded",
            description: "Fictional items are labeled Demo everywhere. Their proposals are in the Review Queue.",
          },
        });
        if (outcome.ok) onLoaded?.();
      }}
    >
      <FlaskConical aria-hidden="true" size={16} strokeWidth={1.75} />
      Load demo data
    </Button>
  );
}

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

/**
 * "Remove demo data" with a confirmation that states what is lost and a
 * choice to keep approved demo content (FR-SRC-05, rules.md §7.2.5).
 */
export function RemoveDemoDataButton({ size = "sm" }: { size?: "sm" | "md" }) {
  const ws = useWorkspace();
  const run = useWorkspaceAction();
  const [keep, setKeep] = useState<"remove" | "keep">("remove");
  const summary = summarizeDemoData(ws);
  const approved = summary.claims + summary.projects + summary.skills;

  if (!hasDemoData(ws)) return null;

  return (
    <ConfirmDialog
      trigger={
        <Button variant="secondary" size={size}>
          Remove demo data
        </Button>
      }
      onOpenChange={(open) => {
        if (open) setKeep("remove");
      }}
      title="Remove demo data?"
      description={
        <div className="flex flex-col gap-3">
          <p>
            This deletes the demo source with {plural(summary.sourceItems, "item", "items")},{" "}
            {plural(summary.evidence, "evidence record", "evidence records")}, and{" "}
            {plural(summary.reviewItems, "proposal", "proposals")}. Your own entries are not affected.
          </p>
          {approved > 0 ? (
            <RadioGroup
              legend={`You approved ${plural(approved, "demo project, achievement, or skill", "demo projects, achievements, or skills")}.`}
              value={keep}
              onValueChange={setKeep}
              options={[
                { value: "remove", label: "Remove them too" },
                {
                  value: "keep",
                  label: "Keep them in the portfolio",
                  hint: "They stay labeled Demo data and are marked “source removed”.",
                },
              ]}
            />
          ) : null}
        </div>
      }
      confirmLabel="Remove demo data"
      destructive
      onConfirm={() => {
        const outcome = run((current, now) => removeDemoData(current, { keepApprovedContent: keep === "keep" }, now), {
          success: { title: "Demo data removed" },
        });
        // A save failure is already reported by `run`; only a refusal keeps the dialog open.
        if (!outcome.ok && !outcome.applied) throw new Error(outcome.error.message);
      }}
    />
  );
}
