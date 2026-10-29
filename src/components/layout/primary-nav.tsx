"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, isActiveRoute } from "@/lib/navigation";
import { cn } from "@/lib/utils/cn";
import { pendingReviewCount } from "@/features/workspace/workspace";
import { useOptionalWorkspaceSnapshot } from "@/components/workspace/workspace-provider";
import { NAV_ICONS } from "./nav-icons";

type PrimaryNavProps = {
  /** Called when a link starts a navigation (closes the mobile drawer). */
  onNavigate?: () => void;
};

/**
 * Primary navigation landmark. The active item is marked with
 * aria-current="page" and a primary-colored bar, not color alone.
 */
export function PrimaryNav(props: PrimaryNavProps) {
  // usePathname may suspend on routes with unknown dynamic params under Cache
  // Components; the fallback keeps the links usable without the active marker.
  return (
    <Suspense fallback={<NavList pathname={null} {...props} />}>
      <ActiveNavList {...props} />
    </Suspense>
  );
}

function ActiveNavList(props: PrimaryNavProps) {
  const pathname = usePathname();
  return <NavList pathname={pathname} {...props} />;
}

export function NavList({ pathname, onNavigate }: PrimaryNavProps & { pathname: string | null }) {
  const snapshot = useOptionalWorkspaceSnapshot();
  const pending = snapshot.phase === "ready" ? pendingReviewCount(snapshot.workspace) : 0;
  return (
    <nav aria-label="Primary">
      <ul className="flex flex-col gap-0.5">
        {NAV_ITEMS.map((item) => {
          const active = pathname !== null && isActiveRoute(pathname, item.href);
          const Icon = NAV_ICONS[item.id];
          return (
            <li key={item.id}>
              <Link
                href={item.href}
                onNavigate={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex h-10 items-center gap-3 rounded-sm px-3 text-label font-medium transition-colors duration-150 ease-out lg:h-9",
                  active
                    ? "bg-surface-muted text-foreground before:absolute before:inset-y-1.5 before:left-0 before:w-[3px] before:rounded-full before:bg-primary"
                    : "text-foreground-secondary hover:bg-control-hover hover:text-foreground",
                )}
              >
                <Icon aria-hidden="true" size={20} strokeWidth={1.75} className="shrink-0" />
                {item.label}
                {item.id === "review" && pending > 0 ? (
                  <span className="ml-auto inline-flex min-w-6 items-center justify-center rounded-sm bg-warning-surface px-1.5 text-meta font-medium text-warning">
                    <span aria-hidden="true">{pending}</span>
                    <span className="sr-only">, {pending} pending</span>
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
