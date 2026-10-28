import {
  DEFAULT_THEME,
  THEME_ATTRIBUTE,
  THEME_STORAGE_KEY,
  parseTheme,
  readStoredTheme,
  writeStoredTheme,
  type Theme,
} from "./theme";
import type { Result } from "@/lib/validation/result";

/**
 * Browser-side theme state. The `data-theme` attribute on <html> is the
 * single source of truth: the bootstrap script sets it before paint, and
 * React reads it through `subscribeToTheme` / `getThemeSnapshot`.
 */

function safeLocalStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function getThemeSnapshot(): Theme {
  return parseTheme(document.documentElement.getAttribute(THEME_ATTRIBUTE));
}

export function getServerThemeSnapshot(): Theme {
  return DEFAULT_THEME;
}

export function subscribeToTheme(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: [THEME_ATTRIBUTE],
  });
  return () => observer.disconnect();
}

function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute(THEME_ATTRIBUTE, theme);
}

/**
 * Applies the theme immediately and tries to persist it. The theme changes
 * even when saving fails; the returned Result says whether it will survive
 * a reload.
 */
export function setTheme(theme: Theme): Result<Theme> {
  applyTheme(theme);
  return writeStoredTheme(safeLocalStorage(), theme);
}

/** Re-applies the stored preference (used after React resets <html> attributes). */
export function applyStoredTheme(): void {
  applyTheme(readStoredTheme(safeLocalStorage()));
}

/** Keeps other open tabs in step when the preference changes in one of them. */
export function subscribeToStoredTheme(): () => void {
  function onStorage(event: StorageEvent) {
    if (event.key === THEME_STORAGE_KEY) applyTheme(parseTheme(event.newValue));
  }
  window.addEventListener("storage", onStorage);
  return () => window.removeEventListener("storage", onStorage);
}
