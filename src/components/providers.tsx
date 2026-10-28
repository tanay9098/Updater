"use client";

import type { ReactNode } from "react";
import { ThemeSync } from "@/components/theme/theme-sync";
import { ToastProvider } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";

/** Client-side providers shared by every route. */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <TooltipProvider delayDuration={400}>
      <ToastProvider>
        <ThemeSync />
        {children}
      </ToastProvider>
    </TooltipProvider>
  );
}
