"use client";

import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { findActiveNavItem } from "@/lib/navigation";

/** Section name in the top bar for orientation. Not a heading: each page owns its h1. */
export function CurrentSection() {
  return (
    <Suspense fallback={null}>
      <SectionLabel />
    </Suspense>
  );
}

function SectionLabel() {
  const item = findActiveNavItem(usePathname());
  if (!item) return null;
  return <span className="truncate text-label font-medium text-foreground-secondary">{item.label}</span>;
}
