import type { ComponentProps } from "react";
import { Slot } from "radix-ui";
import { cn } from "@/lib/utils/cn";
import { Spinner } from "./spinner";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive" | "link";
export type ButtonSize = "sm" | "md" | "icon" | "icon-sm";

const base =
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-sm font-medium text-label " +
  "transition-colors duration-150 ease-out select-none " +
  "disabled:cursor-not-allowed aria-disabled:cursor-not-allowed";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-primary-foreground hover:bg-primary-hover " +
    "disabled:bg-disabled-surface disabled:text-disabled",
  secondary:
    "border border-border-strong bg-control text-foreground hover:bg-control-hover " +
    "disabled:border-border disabled:bg-disabled-surface disabled:text-disabled",
  ghost: "text-foreground-secondary hover:bg-control-hover hover:text-foreground disabled:text-disabled",
  destructive:
    "bg-error text-error-foreground hover:bg-error-hover " +
    "disabled:bg-disabled-surface disabled:text-disabled",
  link: "h-auto px-0 text-link underline underline-offset-4 hover:decoration-2 disabled:text-disabled",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3",
  md: "h-9 px-4",
  icon: "size-9",
  "icon-sm": "size-8",
};

export function buttonClassName({
  variant = "secondary",
  size = "md",
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}): string {
  return cn(base, variants[variant], variant !== "link" && sizes[size], className);
}

export type ButtonProps = ComponentProps<"button"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner, keeps the label, sets aria-busy, and blocks repeat clicks. */
  loading?: boolean;
  /** Render the child element (for example a Next.js Link) with button styling. */
  asChild?: boolean;
};

export function Button({
  variant = "secondary",
  size = "md",
  loading = false,
  asChild = false,
  className,
  disabled,
  children,
  type,
  ...props
}: ButtonProps) {
  const classes = buttonClassName({ variant, size, className });

  if (asChild) {
    return (
      <Slot.Root className={classes} {...props}>
        {children}
      </Slot.Root>
    );
  }

  return (
    <button
      type={type ?? "button"}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Spinner /> : null}
      {children}
    </button>
  );
}
