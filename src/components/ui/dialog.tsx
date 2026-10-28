"use client";

import type { ComponentProps, ReactNode } from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "./button";

/**
 * Radix Dialog: focus trap, Escape to close, focus returned to the trigger.
 * Centered on wider screens, a full-width sheet below `sm` (design.md §4).
 */
export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export const overlayClassName = "fixed inset-0 z-40 bg-overlay data-[state=open]:animate-fade-in";

export const dialogPanelClassName =
  "fixed inset-x-0 bottom-0 z-50 flex max-h-[90dvh] flex-col gap-4 overflow-y-auto rounded-t-md border border-border bg-surface-elevated p-5 text-foreground shadow-elevated " +
  "sm:inset-x-auto sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:w-[calc(100%-2rem)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-md sm:p-6 " +
  "data-[state=open]:animate-pop-in";

type DialogContentProps = Omit<ComponentProps<typeof DialogPrimitive.Content>, "title"> & {
  title: ReactNode;
  description?: ReactNode;
  size?: "form" | "confirm";
};

export function DialogContent({
  title,
  description,
  size = "form",
  className,
  children,
  ...props
}: DialogContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className={overlayClassName} />
      <DialogPrimitive.Content
        className={cn(dialogPanelClassName, size === "form" ? "sm:max-w-lg" : "sm:max-w-md", className)}
        // Without a description Radix warns; an explicit undefined opts out.
        {...(description ? {} : { "aria-describedby": undefined })}
        {...props}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <DialogPrimitive.Title className="text-heading font-semibold">{title}</DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description className="text-body text-foreground-secondary">
                {description}
              </DialogPrimitive.Description>
            ) : null}
          </div>
          <DialogPrimitive.Close asChild>
            <Button variant="ghost" size="icon" aria-label="Close dialog" className="-mt-1 -mr-2">
              <X aria-hidden="true" size={16} strokeWidth={1.75} />
            </Button>
          </DialogPrimitive.Close>
        </div>
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

/** Actions row: stacked full-width on mobile (primary first), right-aligned from `sm`. */
export function DialogFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 pt-2 sm:flex-row-reverse sm:justify-start [&>*]:w-full sm:[&>*]:w-auto",
        className,
      )}
      {...props}
    />
  );
}
