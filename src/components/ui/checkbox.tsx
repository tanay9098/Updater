"use client";

import { useId, type ComponentProps, type ReactNode } from "react";
import { Checkbox as CheckboxPrimitive } from "radix-ui";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type CheckboxProps = Omit<ComponentProps<typeof CheckboxPrimitive.Root>, "children"> & {
  label: ReactNode;
  hint?: ReactNode;
};

/** Selection checkbox with a visible label (design.md §5). */
export function Checkbox({ label, hint, id, className, ...props }: CheckboxProps) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const hintId = hint ? `${controlId}-hint` : undefined;

  return (
    <div className={cn("flex items-start gap-2.5", className)}>
      <CheckboxPrimitive.Root
        id={controlId}
        aria-describedby={hintId}
        className={cn(
          "mt-px flex size-5 shrink-0 items-center justify-center rounded-sm border border-border-strong bg-surface",
          "data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground",
          "disabled:cursor-not-allowed disabled:border-border disabled:bg-disabled-surface",
        )}
        {...props}
      >
        <CheckboxPrimitive.Indicator>
          <Check aria-hidden="true" size={14} strokeWidth={2.5} />
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
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
    </div>
  );
}
