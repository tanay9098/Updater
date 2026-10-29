"use client";

import { Moon, Sun } from "lucide-react";
import { oppositeTheme } from "@/lib/theme/theme";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { useThemeControl } from "./use-theme";

/**
 * Top-bar theme switch. A toggle button with a constant name ("Dark theme")
 * and aria-pressed, per the WAI-ARIA button pattern; the tooltip names the
 * action. The icon follows data-theme through CSS so it is correct before
 * hydration.
 */
export function ThemeToggle() {
  const { theme, changeTheme } = useThemeControl();
  const isDark = theme === "dark";

  return (
    <Tooltip content={isDark ? "Switch to light theme" : "Switch to dark theme"}>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Dark theme"
        aria-pressed={isDark}
        onClick={() => changeTheme(oppositeTheme(theme))}
      >
        <Sun aria-hidden="true" size={20} strokeWidth={1.75} className="dark:hidden" />
        <Moon aria-hidden="true" size={20} strokeWidth={1.75} className="hidden dark:block" />
      </Button>
    </Tooltip>
  );
}
