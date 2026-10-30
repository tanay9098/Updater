"use client";

import type { ReactNode } from "react";
import { AccountProvider } from "@/components/account/account-provider";
import { ThemeSync } from "@/components/theme/theme-sync";
import { ToastProvider } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WorkspaceProvider } from "@/components/workspace/workspace-provider";

/** Client-side providers shared by every route. */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <TooltipProvider delayDuration={400}>
      <ToastProvider>
        <ThemeSync />
        <AccountProvider>
          <WorkspaceProvider>{children}</WorkspaceProvider>
        </AccountProvider>
      </ToastProvider>
    </TooltipProvider>
  );
}
