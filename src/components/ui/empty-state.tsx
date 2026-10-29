import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Shown inside the region it replaces: a short heading, one sentence of
 * guidance, and at most one action. No illustrations (design.md §5).
 */
export function EmptyState({
  title,
  description,
  action,
  headingLevel = 2,
  className,
}: {
  title: string;
  description: ReactNode;
  action?: ReactNode;
  headingLevel?: 2 | 3;
  className?: string;
}) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <div
      className={cn(
        "flex flex-col items-start gap-2 rounded-md border border-dashed border-border-strong px-5 py-8 sm:px-6",
        className,
      )}
    >
      <Heading className="text-subheading font-semibold">{title}</Heading>
      <div className="max-w-prose text-body text-foreground-secondary">{description}</div>
      {action ? <div className="pt-2">{action}</div> : null}
    </div>
  );
}
