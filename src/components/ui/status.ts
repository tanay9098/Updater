import {
  Circle,
  CircleAlert,
  CircleCheck,
  CircleDashed,
  FlaskConical,
  Info,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";

/** Status tones shared by badges, alerts, and toasts (design.md §2.1, §5). */
export type StatusTone = "success" | "warning" | "error" | "info" | "neutral" | "demo" | "planned";

export const TONE_ICONS: Record<StatusTone, LucideIcon> = {
  success: CircleCheck,
  warning: TriangleAlert,
  error: CircleAlert,
  info: Info,
  neutral: Circle,
  demo: FlaskConical,
  planned: CircleDashed,
};

export const TONE_TEXT: Record<StatusTone, string> = {
  success: "text-success",
  warning: "text-warning",
  error: "text-error",
  info: "text-info",
  neutral: "text-foreground-secondary",
  demo: "text-demo",
  planned: "text-foreground-secondary",
};

export const TONE_SURFACE: Record<StatusTone, string> = {
  success: "bg-success-surface",
  warning: "bg-warning-surface",
  error: "bg-error-surface",
  info: "bg-info-surface",
  neutral: "bg-surface-muted",
  demo: "bg-demo-surface",
  planned: "bg-transparent",
};
