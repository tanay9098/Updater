import { THEME_BOOTSTRAP_SCRIPT } from "@/lib/theme/theme";

/**
 * Applies the stored theme before first paint (D-008). Render inside <head>.
 *
 * dangerouslySetInnerHTML is allowed here by rules.md §7.3.7: the script is a
 * static, code-owned string built from constants, with no user or external
 * input.
 */
export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />;
}
