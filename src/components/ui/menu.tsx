"use client";

import type { ComponentProps } from "react";
import { DropdownMenu } from "radix-ui";
import { cn } from "@/lib/utils/cn";

/** Radix DropdownMenu for secondary actions (design.md §5). */
export const Menu = DropdownMenu.Root;
export const MenuTrigger = DropdownMenu.Trigger;

export function MenuContent({
  className,
  sideOffset = 4,
  align = "end",
  ...props
}: ComponentProps<typeof DropdownMenu.Content>) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        sideOffset={sideOffset}
        align={align}
        className={cn(
          "z-50 min-w-44 rounded-md border border-border bg-surface-elevated p-1 text-foreground shadow-elevated",
          "data-[state=open]:animate-fade-in",
          className,
        )}
        {...props}
      />
    </DropdownMenu.Portal>
  );
}

export function MenuItem({
  className,
  destructive = false,
  ...props
}: ComponentProps<typeof DropdownMenu.Item> & { destructive?: boolean }) {
  return (
    <DropdownMenu.Item
      className={cn(
        "flex h-8 cursor-default items-center gap-2 rounded-sm px-2 text-body outline-none select-none",
        "data-highlighted:bg-control-hover data-disabled:text-disabled",
        destructive && "text-error",
        className,
      )}
      {...props}
    />
  );
}

export function MenuSeparator({ className, ...props }: ComponentProps<typeof DropdownMenu.Separator>) {
  return <DropdownMenu.Separator className={cn("my-1 h-px bg-border", className)} {...props} />;
}
