import { describe, expect, it } from "vitest";
import {
  DEFAULT_THEME,
  THEME_BOOTSTRAP_SCRIPT,
  THEME_STORAGE_KEY,
  oppositeTheme,
  parseTheme,
  readStoredTheme,
  writeStoredTheme,
  type ThemeStorage,
} from "./theme";

function memoryStorage(initial: Record<string, string> = {}): ThemeStorage & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => {
      data[key] = value;
    },
  };
}

const throwingStorage = (error: Error): ThemeStorage => ({
  getItem: () => {
    throw error;
  },
  setItem: () => {
    throw error;
  },
});

describe("theme rules", () => {
  it("defaults to the bright theme", () => {
    expect(DEFAULT_THEME).toBe("light");
    expect(THEME_STORAGE_KEY).toBe("updater:theme");
  });

  it("accepts only known theme values", () => {
    expect(parseTheme("dark")).toBe("dark");
    expect(parseTheme("light")).toBe("light");
    expect(parseTheme("DARK")).toBe("light");
    expect(parseTheme("system")).toBe("light");
    expect(parseTheme(null)).toBe("light");
    expect(parseTheme(undefined)).toBe("light");
  });

  it("flips between the two themes", () => {
    expect(oppositeTheme("light")).toBe("dark");
    expect(oppositeTheme("dark")).toBe("light");
  });
});

describe("readStoredTheme", () => {
  it("reads a stored preference", () => {
    expect(readStoredTheme(memoryStorage({ [THEME_STORAGE_KEY]: "dark" }))).toBe("dark");
  });

  it("falls back to light when nothing, garbage, or no storage is present", () => {
    expect(readStoredTheme(memoryStorage())).toBe("light");
    expect(readStoredTheme(memoryStorage({ [THEME_STORAGE_KEY]: "<script>" }))).toBe("light");
    expect(readStoredTheme(null)).toBe("light");
  });

  it("falls back to light when storage throws", () => {
    expect(readStoredTheme(throwingStorage(new Error("SecurityError")))).toBe("light");
  });
});

describe("writeStoredTheme", () => {
  it("persists the preference and reports success", () => {
    const storage = memoryStorage();
    expect(writeStoredTheme(storage, "dark")).toEqual({ ok: true, value: "dark" });
    expect(storage.data[THEME_STORAGE_KEY]).toBe("dark");
  });

  it("reports unavailable storage instead of pretending it saved", () => {
    const missing = writeStoredTheme(null, "dark");
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error.code).toBe("storage_unavailable");

    const blocked = writeStoredTheme(throwingStorage(new Error("SecurityError")), "dark");
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.error.code).toBe("storage_unavailable");
  });

  it("reports a full quota", () => {
    const full = writeStoredTheme(
      throwingStorage(new DOMException("full", "QuotaExceededError")),
      "dark",
    );
    expect(full.ok).toBe(false);
    if (!full.ok) expect(full.error.code).toBe("storage_quota_exceeded");
  });
});

describe("THEME_BOOTSTRAP_SCRIPT", () => {
  const run = () => new Function(THEME_BOOTSTRAP_SCRIPT)();

  it("applies a stored dark preference before React runs", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "dark");
    document.documentElement.setAttribute("data-theme", "light");
    run();
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("leaves the server default in place for missing or unknown values", () => {
    document.documentElement.setAttribute("data-theme", "light");
    run();
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");

    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark" onload="x');
    run();
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("does not throw when storage access throws", () => {
    const original = Object.getOwnPropertyDescriptor(window, "localStorage");
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new Error("SecurityError");
      },
    });
    try {
      expect(run).not.toThrow();
    } finally {
      if (original) Object.defineProperty(window, "localStorage", original);
    }
  });
});
