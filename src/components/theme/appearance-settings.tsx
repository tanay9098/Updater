"use client";

import { THEME_LABELS, THEMES, DEFAULT_THEME } from "@/lib/theme/theme";
import { RadioGroup, type RadioOption } from "@/components/ui/radio-group";
import type { Theme } from "@/lib/theme/theme";
import { useThemeControl } from "./use-theme";

const options: ReadonlyArray<RadioOption<Theme>> = THEMES.map((theme) => ({
  value: theme,
  label: theme === DEFAULT_THEME ? `${THEME_LABELS[theme]} (default)` : THEME_LABELS[theme],
}));

/** Settings → Appearance (design.md §13). Shares state with the top-bar toggle. */
export function AppearanceSettings() {
  const { theme, changeTheme } = useThemeControl();
  return <RadioGroup legend="Theme" options={options} value={theme} onValueChange={changeTheme} />;
}
