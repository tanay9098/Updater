import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";
import { TONE_ICONS, TONE_SURFACE, TONE_TEXT } from "./status";

export type AlertTone = "success" | "warning" | "error" | "info";

/**
 * Inline message near its cause (design.md §5). Errors use role="alert" so
 * they are announced; other tones use role="status".
 */
export function Alert({
  tone,
  title,
  children,
  action,
  className,
}: {
  tone: AlertTone;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const Icon = TONE_ICONS[tone];
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex flex-col gap-3 rounded-md border border-border px-4 py-3 sm:flex-row sm:items-start",
        TONE_SURFACE[tone],
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-2.5">
        <Icon
          aria-hidden="true"
          size={16}
          strokeWidth={1.75}
          className={cn("mt-0.5 shrink-0", TONE_TEXT[tone])}
        />
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className={cn("text-label font-semibold", TONE_TEXT[tone])}>{title}</p>
          {children ? <div className="text-body text-foreground-secondary">{children}</div> : null}
        </div>
      </div>
      {action ? <div className="shrink-0 sm:ml-2">{action}</div> : null}
    </div>
  );
}
