import type { ReactNode } from "react";
import { Sidebar } from "./sidebar";
import { TopBar } from "./top-bar";

export const MAIN_CONTENT_ID = "main-content";

/** Skip link, sidebar (≥ lg), top bar, and the main landmark (design.md §4, §15). */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <>
      <a
        href={`#${MAIN_CONTENT_ID}`}
        className="sr-only z-[70] rounded-sm bg-primary text-label font-medium text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:px-4 focus:py-2 print:hidden"
      >
        Skip to content
      </a>
      <div className="flex min-h-dvh">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar />
          <main
            id={MAIN_CONTENT_ID}
            tabIndex={-1}
            className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 focus-visible:-outline-offset-2 sm:px-6 lg:px-8 print:max-w-none print:p-0"
          >
            {children}
          </main>
        </div>
      </div>
    </>
  );
}
