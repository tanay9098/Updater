"use client";

import { useEffect } from "react";

/**
 * Asks the browser to confirm leaving the page while a form has unsaved
 * edits. In-app navigation keeps the form mounted (Cache Components keeps
 * recent routes alive), so this only covers reloads and closing the tab.
 */
export function useUnsavedWarning(dirty: boolean): void {
  useEffect(() => {
    if (!dirty) return;
    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);
}
