"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { Theme } from "@/lib/theme/theme";
import {
  getServerThemeSnapshot,
  getThemeSnapshot,
  setTheme,
  subscribeToTheme,
} from "@/lib/theme/theme-store";
import { useToast } from "@/components/ui/toast";

/** Current theme. Renders as the default on the server, then follows <html data-theme>. */
export function useTheme(): Theme {
  return useSyncExternalStore(subscribeToTheme, getThemeSnapshot, getServerThemeSnapshot);
}

/**
 * Theme plus a setter that reports the real persistence outcome. The theme
 * always changes; if the browser refuses to store it, the user is told the
 * choice lasts only for this visit.
 */
export function useThemeControl(): { theme: Theme; changeTheme: (next: Theme) => void } {
  const theme = useTheme();
  const { notify } = useToast();

  const changeTheme = useCallback(
    (next: Theme) => {
      const result = setTheme(next);
      if (!result.ok) {
        notify({
          tone: "warning",
          title: "Theme changed for this visit only",
          description: `${result.error.message} The next visit will open in the light theme.`,
        });
      }
    },
    [notify],
  );

  return { theme, changeTheme };
}
