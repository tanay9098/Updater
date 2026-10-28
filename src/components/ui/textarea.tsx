"use client";

import type { ComponentProps } from "react";
import { cn } from "@/lib/utils/cn";
import { controlClassName, useFieldControl } from "./field";

export function Textarea({ className, rows = 4, ...props }: ComponentProps<"textarea">) {
  const controlProps = useFieldControl(props);
  return (
    <textarea rows={rows} className={cn(controlClassName, "py-2", className)} {...controlProps} />
  );
}
