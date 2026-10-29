import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

/** Neutral placeholder block. Decorative: wrap groups in LoadingState. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded-sm bg-border motion-reduce:animate-none", className)}
    />
  );
}

/** Announces loading once to assistive technology while skeletons are shown. */
export function LoadingState({
  label = "Loading…",
  children,
  className,
}: {
  label?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div role="status" aria-live="polite" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}
