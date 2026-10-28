"use client";

import type { ComponentProps } from "react";
import { cn } from "@/lib/utils/cn";
import { controlClassName, useFieldControl } from "./field";

export function Input({ className, type = "text", ...props }: ComponentProps<"input">) {
  const controlProps = useFieldControl(props);
  return <input type={type} className={cn(controlClassName, "h-9", className)} {...controlProps} />;
}
