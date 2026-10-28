import { err, ok, type Result } from "@/lib/validation/result";

/**
 * Theme rules (design.md §2, D-008). Pure functions over a minimal storage
 * interface so they can be tested without a browser.
 */

export const THEMES = ["light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

/** Bright mode is the default on every first visit, whatever the OS prefers. */
export const DEFAULT_THEME: Theme = "light";
export const THEME_STORAGE_KEY = "updater:theme";
export const THEME_ATTRIBUTE = "data-theme";

export const THEME_LABELS: Record<Theme, string> = {
  light: "Light",
  dark: "Dark",
};

export type ThemeStorage = Pick<Storage, "getItem" | "setItem">;

export function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark";
}

/** Unknown, missing, or tampered values fall back to the default. */
export function parseTheme(value: unknown): Theme {
  return isTheme(value) ? value : DEFAULT_THEME;
}

export function oppositeTheme(theme: Theme): Theme {
  return theme === "dark" ? "light" : "dark";
}

/** Reads the stored preference. Storage that throws (blocked, private mode) yields the default. */
export function readStoredTheme(storage: ThemeStorage | null | undefined): Theme {
  if (!storage) return DEFAULT_THEME;
  try {
    return parseTheme(storage.getItem(THEME_STORAGE_KEY));
  } catch {
    return DEFAULT_THEME;
  }
}

/** Persists the preference and reports whether it was actually saved. */
export function writeStoredTheme(
  storage: ThemeStorage | null | undefined,
  theme: Theme,
): Result<Theme> {
  if (!storage) {
    return err("storage_unavailable", "This browser doesn't allow saving preferences.");
  }
  try {
    storage.setItem(THEME_STORAGE_KEY, theme);
    return ok(theme);
  } catch (error) {
    const quota = error instanceof DOMException && error.name === "QuotaExceededError";
    return quota
      ? err("storage_quota_exceeded", "Browser storage is full.")
      : err("storage_unavailable", "This browser doesn't allow saving preferences.");
  }
}

/**
 * Inline script that applies the stored theme before first paint, so a
 * reload in dark mode never flashes bright (FR-THEME-02). Built only from
 * code-owned constants. It accepts nothing but the two known theme values.
 */
export const THEME_BOOTSTRAP_SCRIPT = `(function(){try{var t=window.localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});if(t==="light"||t==="dark")document.documentElement.setAttribute(${JSON.stringify(
  THEME_ATTRIBUTE,
)},t)}catch(e){}})();`;
