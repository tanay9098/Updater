import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { TONE_ICONS, TONE_SURFACE, TONE_TEXT, type StatusTone } from "./status";

/**
 * Icon + text label + tone. State is never conveyed by color alone
 * (design.md §2.1, §5).
 */
export function StatusBadge({
  tone,
  label,
  icon,
  className,
}: {
  tone: StatusTone;
  label: string;
  /** Overrides the tone's default icon. */
  icon?: LucideIcon;
  className?: string;
}) {
  const Icon = icon ?? TONE_ICONS[tone];
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1 rounded-sm border px-1.5 text-meta font-medium whitespace-nowrap",
        TONE_SURFACE[tone],
        TONE_TEXT[tone],
        tone === "planned" ? "border-dashed border-border-strong" : "border-transparent",
        className,
      )}
    >
      <Icon aria-hidden="true" size={14} strokeWidth={1.75} className="shrink-0" />
      {label}
    </span>
  );
}
