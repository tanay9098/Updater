"use client";

import Link from "next/link";
import { FlaskConical } from "lucide-react";
import { hasDemoData } from "@/features/workspace/workspace";
import { useOptionalWorkspaceSnapshot } from "@/components/workspace/workspace-provider";

/** Global top-bar indicator while any demo data exists (design.md §4, §16). */
export function DemoIndicator() {
  const snapshot = useOptionalWorkspaceSnapshot();
  if (snapshot.phase !== "ready" || !hasDemoData(snapshot.workspace)) return null;
  return (
    <Link
      href="/settings#data"
      className="inline-flex h-8 items-center gap-1.5 rounded-sm bg-demo-surface px-2 text-meta font-medium whitespace-nowrap text-demo"
    >
      <FlaskConical aria-hidden="true" size={14} strokeWidth={1.75} />
      <span>
        <span className="hidden sm:inline">Includes </span>demo data
      </span>
    </Link>
  );
}
