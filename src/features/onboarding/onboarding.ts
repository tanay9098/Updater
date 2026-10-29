import { ok, type Result } from "@/lib/validation/result";
import { findSourceForProvider } from "@/lib/providers/registry";
import type { Workspace } from "@/types/domain";
import { loadDemoWorkspace } from "@/features/sources/demo";

export type StartChoice = "manual" | "demo" | "skipped";

/**
 * Finishes onboarding (design.md §7) and records the choice. Choosing demo
 * data loads the fictional fixtures in the same step, so both are saved
 * together or not at all.
 */
export function completeOnboarding(ws: Workspace, choice: StartChoice, now: string): Result<Workspace> {
  let next = ws;
  if (choice === "demo" && !findSourceForProvider(ws, "demo")) {
    const loaded = loadDemoWorkspace(ws, now);
    if (!loaded.ok) return loaded;
    next = loaded.value;
  }
  return ok({ ...next, onboarding: { completedAt: now, startChoice: choice } });
}

/** Lets the user walk through onboarding again. Keeps all data. */
export function restartOnboarding(ws: Workspace): Result<Workspace> {
  return ok({ ...ws, onboarding: {} });
}

export function needsOnboarding(ws: Workspace): boolean {
  return !ws.onboarding.completedAt;
}
