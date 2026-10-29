"use client";

import { createContext, useContext, useId, type ReactNode } from "react";
import { CircleAlert } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type FieldContextValue = {
  id: string;
  describedBy: string | undefined;
  invalid: boolean;
  required: boolean;
};

const FieldContext = createContext<FieldContextValue | null>(null);

export type FieldProps = {
  label: string;
  /** Helper text shown below the control. */
  hint?: ReactNode;
  /** Validation message. Marks the control invalid and links it with aria-describedby. */
  error?: string;
  required?: boolean;
  /** Explicit id for the control; generated when omitted. */
  id?: string;
  className?: string;
  children: ReactNode;
};

/**
 * Label, control, helper text, and error, wired together for assistive
 * technology (design.md §5, §15). Wrap one Input, Textarea, or Select.
 */
export function Field({ label, hint, error, required = false, id, className, children }: FieldProps) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const hintId = hint ? `${controlId}-hint` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={controlId} className="text-label font-medium text-foreground">
        {label}
        {required ? (
          <>
            {" "}
            <span className="font-normal text-muted">(required)</span>
          </>
        ) : null}
      </label>
      <FieldContext.Provider value={{ id: controlId, describedBy, invalid: Boolean(error), required }}>
        {children}
      </FieldContext.Provider>
      {hint ? (
        <p id={hintId} className="text-support text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="flex items-start gap-1.5 text-support text-error">
          <CircleAlert aria-hidden="true" size={16} strokeWidth={1.75} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}

type ControlAria = {
  id?: string;
  required?: boolean;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "true" | "false" | "grammar" | "spelling";
};

/** Merges the surrounding Field's id and ARIA wiring into a control's props. */
export function useFieldControl<P extends ControlAria>(props: P): P {
  const field = useContext(FieldContext);
  if (!field) return props;
  const describedBy =
    [field.describedBy, props["aria-describedby"]].filter(Boolean).join(" ") || undefined;
  return {
    ...props,
    id: props.id ?? field.id,
    required: props.required ?? (field.required || undefined),
    "aria-describedby": describedBy,
    "aria-invalid": props["aria-invalid"] ?? (field.invalid || undefined),
  };
}

export const controlClassName =
  "w-full min-w-0 rounded-sm border border-border-strong bg-surface px-3 text-body text-foreground " +
  "placeholder:text-muted transition-colors duration-150 ease-out " +
  "aria-invalid:border-error " +
  "disabled:cursor-not-allowed disabled:border-border disabled:bg-disabled-surface disabled:text-disabled";
