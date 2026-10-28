"use client";

import { useId, type ComponentProps, type ReactNode } from "react";
import { RadioGroup as RadioGroupPrimitive } from "radix-ui";
import { cn } from "@/lib/utils/cn";

export type RadioOption<V extends string> = {
  value: V;
  label: ReactNode;
  hint?: ReactNode;
};

type RadioGroupProps<V extends string> = Omit<
  ComponentProps<typeof RadioGroupPrimitive.Root>,
  "children" | "onValueChange" | "value" | "defaultValue"
> & {
  /** Visible group label. */
  legend: ReactNode;
  options: ReadonlyArray<RadioOption<V>>;
  value: V;
  onValueChange: (value: V) => void;
};

/** Labeled radio group with arrow-key navigation (WAI-ARIA radio group pattern). */
export function RadioGroup<V extends string>({
  legend,
  options,
  value,
  onValueChange,
  className,
  ...props
}: RadioGroupProps<V>) {
  const baseId = useId();
  const legendId = `${baseId}-legend`;

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <span id={legendId} className="text-label font-medium">
        {legend}
      </span>
      <RadioGroupPrimitive.Root
        aria-labelledby={legendId}
        value={value}
        onValueChange={(next) => {
          const option = options.find((candidate) => candidate.value === next);
          if (option) onValueChange(option.value);
        }}
        className="flex flex-col gap-2.5"
        {...props}
      >
        {options.map((option) => {
          const itemId = `${baseId}-${option.value}`;
          const hintId = option.hint ? `${itemId}-hint` : undefined;
          return (
            <div key={option.value} className="flex items-start gap-2.5">
              <RadioGroupPrimitive.Item
                id={itemId}
                value={option.value}
                aria-describedby={hintId}
                className={cn(
                  "mt-px flex size-5 shrink-0 items-center justify-center rounded-full border border-border-strong bg-surface",
                  "data-[state=checked]:border-primary",
                  "disabled:cursor-not-allowed disabled:border-border disabled:bg-disabled-surface",
                )}
              >
                <RadioGroupPrimitive.Indicator className="block size-2.5 rounded-full bg-primary" />
              </RadioGroupPrimitive.Item>
              <div className="flex flex-col gap-0.5">
                <label htmlFor={itemId} className="cursor-pointer text-label font-medium">
                  {option.label}
                </label>
                {option.hint ? (
                  <p id={hintId} className="text-support text-muted">
                    {option.hint}
                  </p>
                ) : null}
              </div>
            </div>
          );
        })}
      </RadioGroupPrimitive.Root>
    </div>
  );
}
