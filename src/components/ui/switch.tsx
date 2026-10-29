"use client";

import { useId, type ComponentProps, type ReactNode } from "react";
import { Switch as SwitchPrimitive } from "radix-ui";
import { cn } from "@/lib/utils/cn";

type SwitchProps = Omit<ComponentProps<typeof SwitchPrimitive.Root>, "children"> & {
  label: ReactNode;
  hint?: ReactNode;
};

/** Immediate on/off setting only (design.md §5). Use Checkbox for selections. */
export function Switch({ label, hint, id, className, ...props }: SwitchProps) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const hintId = hint ? `${controlId}-hint` : undefined;

  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div className="flex flex-col gap-0.5">
        <label htmlFor={controlId} className="cursor-pointer text-label font-medium">
          {label}
        </label>
        {hint ? (
          <p id={hintId} className="text-support text-muted">
            {hint}
          </p>
        ) : null}
      </div>
      <SwitchPrimitive.Root
        id={controlId}
        aria-describedby={hintId}
        className={cn(
          "relative inline-flex h-6 w-10 shrink-0 cursor-pointer items-center rounded-full border border-border-strong bg-surface-muted",
          "transition-colors duration-150 ease-out",
          "data-[state=checked]:border-primary data-[state=checked]:bg-primary",
          "disabled:cursor-not-allowed disabled:opacity-60",
        )}
        {...props}
      >
        <SwitchPrimitive.Thumb
          className={cn(
            "block size-4 translate-x-[3px] rounded-full bg-muted shadow-elevated",
            "transition-transform duration-150 ease-out",
            "data-[state=checked]:translate-x-[19px] data-[state=checked]:bg-primary-foreground",
          )}
        />
      </SwitchPrimitive.Root>
    </div>
  );
}
