"use client";

import { useState, type ReactNode } from "react";
import { AlertDialog } from "radix-ui";
import { cn } from "@/lib/utils/cn";
import { Alert } from "./alert";
import { Button } from "./button";
import { DialogFooter, dialogPanelClassName, overlayClassName } from "./dialog";

export type ConfirmDialogProps = {
  /** Element that opens the dialog. Omit when controlling `open` yourself. */
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Names the action, for example "Reset workspace?". */
  title: string;
  /** States exactly what is lost or changed. */
  description: ReactNode;
  /** Labeled with the action ("Reset workspace"), never "OK". */
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  /**
   * Runs the action. The dialog stays open while a returned promise is
   * pending and closes only after it resolves. A rejection is shown inside
   * the dialog instead of closing it.
   */
  onConfirm: () => void | Promise<void>;
};

/**
 * Confirmation for consequential actions (design.md §5). Built on Radix
 * AlertDialog, which focuses Cancel first and does not close on outside click.
 */
export function ConfirmDialog({
  trigger,
  open: controlledOpen,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  destructive = false,
  onConfirm,
}: ConfirmDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const open = controlledOpen ?? uncontrolledOpen;

  function setOpen(next: boolean) {
    if (pending) return;
    if (next) setFailure(null);
    if (controlledOpen === undefined) setUncontrolledOpen(next);
    onOpenChange?.(next);
  }

  async function confirm() {
    setFailure(null);
    setPending(true);
    try {
      await onConfirm();
      setPending(false);
      if (controlledOpen === undefined) setUncontrolledOpen(false);
      onOpenChange?.(false);
    } catch (error) {
      setPending(false);
      setFailure(error instanceof Error && error.message ? error.message : "The action could not be completed.");
    }
  }

  return (
    <AlertDialog.Root open={open} onOpenChange={setOpen}>
      {trigger ? <AlertDialog.Trigger asChild>{trigger}</AlertDialog.Trigger> : null}
      <AlertDialog.Portal>
        <AlertDialog.Overlay className={overlayClassName} />
        <AlertDialog.Content className={cn(dialogPanelClassName, "sm:max-w-md")}>
          <div className="flex flex-col gap-1">
            <AlertDialog.Title className="text-heading font-semibold">{title}</AlertDialog.Title>
            <AlertDialog.Description asChild>
              <div className="text-body text-foreground-secondary">{description}</div>
            </AlertDialog.Description>
          </div>
          {failure ? <Alert tone="error" title="This action couldn't be completed">{failure}</Alert> : null}
          <DialogFooter>
            <Button
              variant={destructive ? "destructive" : "primary"}
              loading={pending}
              onClick={() => void confirm()}
            >
              {confirmLabel}
            </Button>
            <AlertDialog.Cancel asChild>
              <Button variant="secondary" disabled={pending}>
                {cancelLabel}
              </Button>
            </AlertDialog.Cancel>
          </DialogFooter>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
