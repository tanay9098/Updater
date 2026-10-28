"use client";

import { useLayoutEffect } from "react";
import { applyStoredTheme, subscribeToStoredTheme } from "@/lib/theme/theme-store";

/**
 * Re-applies the stored theme after hydration and follows changes made in
 * other tabs. In development, React's Strict Mode remount resets <html>
 * attributes, clearing what the bootstrap script set; in production the
 * re-apply is a no-op.
 */
export function ThemeSync() {
  useLayoutEffect(() => {
    applyStoredTheme();
    return subscribeToStoredTheme();
  }, []);
  return null;
}
