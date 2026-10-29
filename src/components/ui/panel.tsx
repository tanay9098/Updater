import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Bordered section (design.md §1): 8 px radius, 1 px border, no shadow.
 * Content inside uses dividers rather than nested rounded containers.
 */
export function Panel({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className={cn("rounded-md border border-border bg-surface", className)}>
      <div className="flex flex-col gap-3 border-b border-border px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 id={headingId} className="text-heading font-semibold">
            {title}
          </h2>
          {description ? <p className="text-support text-muted">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
      </div>
      <div className="px-4 py-4 sm:px-5">{children}</div>
    </section>
  );
}
