import Link from "next/link";

/**
 * Product identity: mark + name, linking to Overview. `compact` keeps only
 * the mark visible below `sm` (the name stays as screen-reader text), so the
 * top bar fits at 320 px with the demo indicator, theme toggle, and account
 * button (design.md §4).
 */
export function ProductMark({ onNavigate, compact = false }: { onNavigate?: () => void; compact?: boolean }) {
  return (
    <Link
      href="/"
      onNavigate={onNavigate}
      className="inline-flex items-center gap-2 rounded-sm text-subheading font-semibold text-foreground"
    >
      <svg aria-hidden="true" viewBox="0 0 32 32" className="size-6 shrink-0 text-primary">
        <rect width="32" height="32" rx="7" fill="currentColor" />
        <path
          d="M10 9v8a6 6 0 0 0 12 0V9"
          fill="none"
          stroke="var(--primary-foreground)"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
      <span className={compact ? "max-sm:sr-only" : undefined}>Updater</span>
    </Link>
  );
}
