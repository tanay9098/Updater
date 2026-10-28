"use client";

import { useEffect, useState } from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { overlayClassName } from "@/components/ui/dialog";
import { PrimaryNav } from "./primary-nav";
import { ProductMark } from "./product-mark";
import { StorageNote } from "./storage-note";

const DESKTOP_QUERY = "(min-width: 64rem)";

/**
 * Navigation drawer below lg (design.md §4): a modal Radix Dialog with a
 * focus trap. Closes on Escape, on outside click, on navigation, and when
 * the viewport grows to the desktop layout.
 */
export function MobileNav() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const query = window.matchMedia(DESKTOP_QUERY);
    const closeOnDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) setOpen(false);
    };
    query.addEventListener("change", closeOnDesktop);
    return () => query.removeEventListener("change", closeOnDesktop);
  }, []);

  const close = () => setOpen(false);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger asChild>
        <Button variant="ghost" size="icon" aria-label="Open navigation" className="-ml-2 lg:hidden">
          <Menu aria-hidden="true" size={20} strokeWidth={1.75} />
        </Button>
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className={overlayClassName} />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[calc(100vw-3rem)] flex-col border-r border-border bg-surface text-foreground shadow-elevated data-[state=open]:animate-drawer-in"
        >
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
            <DialogPrimitive.Title className="sr-only">Navigation</DialogPrimitive.Title>
            <ProductMark onNavigate={close} />
            <DialogPrimitive.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Close navigation" className="-mr-2">
                <X aria-hidden="true" size={20} strokeWidth={1.75} />
              </Button>
            </DialogPrimitive.Close>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-4">
            <PrimaryNav onNavigate={close} />
          </div>
          <div className="shrink-0 border-t border-border px-4 py-4">
            <StorageNote />
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
