"use client";

import type { ComponentProps } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { controlClassName, useFieldControl } from "./field";

/** Native select (design.md §5): accessible by default, styled with tokens. */
export function Select({ className, children, ...props }: ComponentProps<"select">) {
  const controlProps = useFieldControl(props);
  return (
    <div className="relative min-w-0">
      <select
        className={cn(controlClassName, "h-9 cursor-pointer appearance-none pr-9", className)}
        {...controlProps}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        size={16}
        strokeWidth={1.75}
        className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted"
      />
    </div>
  );
}
