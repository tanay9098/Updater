import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";

/** Every workspace page shares the app shell (design.md §4). */
export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
