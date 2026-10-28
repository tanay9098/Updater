"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Pathname the focus logic last handled. Starts at the URL the app loaded
 * with, so the initial page load (and React Strict Mode's re-run of effects)
 * never moves focus.
 */
let lastFocusedPath: string | null = typeof window === "undefined" ? null : window.location.pathname;

/**
 * Page title (one h1 per page), one-line description, and an optional
 * primary action (design.md §4).
 *
 * After a client-side navigation, focus moves to the h1 so keyboard and
 * screen-reader users start at the new page (design.md §15). With Cache
 * Components, Next.js keeps previous pages mounted but hidden in <Activity>;
 * effects re-run when a page becomes visible again, so back/forward
 * navigation is covered too.
 */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const path = window.location.pathname;
    if (lastFocusedPath === path) return;
    lastFocusedPath = path;
    headingRef.current?.focus();
  }, []);

  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 flex-col gap-1">
        <h1 ref={headingRef} tabIndex={-1} className="text-title font-semibold">
          {title}
        </h1>
        {description ? <p className="text-body text-foreground-secondary">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
