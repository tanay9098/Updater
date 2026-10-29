"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { Toast as ToastPrimitive } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { buttonClassName } from "./button";
import { TONE_ICONS, TONE_TEXT } from "./status";

export type ToastTone = "success" | "info" | "warning" | "error";

export type ToastOptions = {
  title: string;
  description?: string;
  tone?: ToastTone;
  action?: {
    label: string;
    /** Describes how to do the same thing without the toast (Radix requirement). */
    altText: string;
    onClick: () => void;
  };
};

type ToastEntry = ToastOptions & { id: number };

type ToastContextValue = {
  /**
   * Shows feedback for an action. Call it only after the action's real
   * outcome is known: never announce success before it happened (rules.md §7.1).
   */
  notify: (toast: ToastOptions) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const MAX_VISIBLE = 3;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const nextId = useRef(0);

  const notify = useCallback((toast: ToastOptions) => {
    nextId.current += 1;
    const entry = { ...toast, id: nextId.current };
    setToasts((current) => [...current.slice(-(MAX_VISIBLE - 1)), entry]);
  }, []);

  const remove = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastPrimitive.Provider swipeDirection="right" label="Notifications">
      <ToastContext.Provider value={value}>{children}</ToastContext.Provider>
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onClose={() => remove(toast.id)} />
      ))}
      <ToastPrimitive.Viewport className="fixed inset-x-0 bottom-0 z-[60] flex flex-col gap-2 p-4 outline-none sm:left-auto sm:w-full sm:max-w-sm" />
    </ToastPrimitive.Provider>
  );
}

function ToastItem({ toast, onClose }: { toast: ToastEntry; onClose: () => void }) {
  const tone = toast.tone ?? "info";
  const Icon = TONE_ICONS[tone];
  const needsAttention = tone === "warning" || tone === "error";

  return (
    <ToastPrimitive.Root
      // Assertive announcement only for problems; everything else is polite.
      type={needsAttention ? "foreground" : "background"}
      duration={needsAttention ? 10000 : 6000}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      className={cn(
        "flex items-start gap-3 rounded-md border border-border bg-surface-elevated p-3 text-foreground shadow-elevated",
        "data-[state=open]:animate-toast-in",
        "data-[swipe=move]:translate-x-(--radix-toast-swipe-move-x) data-[swipe=cancel]:translate-x-0",
      )}
    >
      <Icon aria-hidden="true" size={16} strokeWidth={1.75} className={cn("mt-0.5 shrink-0", TONE_TEXT[tone])} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <ToastPrimitive.Title className="text-label font-semibold">{toast.title}</ToastPrimitive.Title>
        {toast.description ? (
          <ToastPrimitive.Description className="text-support text-foreground-secondary">
            {toast.description}
          </ToastPrimitive.Description>
        ) : null}
        {toast.action ? (
          <ToastPrimitive.Action
            altText={toast.action.altText}
            onClick={toast.action.onClick}
            className={buttonClassName({ variant: "link", className: "mt-1 self-start text-label" })}
          >
            {toast.action.label}
          </ToastPrimitive.Action>
        ) : null}
      </div>
      <ToastPrimitive.Close
        aria-label="Dismiss notification"
        className={buttonClassName({ variant: "ghost", size: "icon-sm", className: "-mt-1 -mr-1" })}
      >
        <X aria-hidden="true" size={16} strokeWidth={1.75} />
      </ToastPrimitive.Close>
    </ToastPrimitive.Root>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside <ToastProvider>.");
  return context;
}
