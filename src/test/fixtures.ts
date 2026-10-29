import { addManualItem } from "@/features/sources/manual";
import { loadDemoWorkspace } from "@/features/sources/demo";
import { updateProfile } from "@/features/profile/profile";
import { createEmptyWorkspace } from "@/features/workspace/workspace";
import type { ManualEntryInput } from "@/lib/validation/domain";
import type { Workspace } from "@/types/domain";

/** Fixed clock values so tests are deterministic. */
export const T0 = "2026-10-29T10:00:00.000Z";
export const T1 = "2026-10-29T11:00:00.000Z";
export const T2 = "2026-10-29T12:00:00.000Z";

/** Unwraps a successful Result or fails the test with its error. */
export function must<T>(result: { ok: true; value: T } | { ok: false; error: { code: string; message: string } }): T {
  if (!result.ok) throw new Error(`Expected success, got ${result.error.code}: ${result.error.message}`);
  return result.value;
}

export function workspaceWithProfile(): Workspace {
  return must(updateProfile(createEmptyWorkspace(), { name: "Sam Rivera", headline: "", intro: "", location: "", email: "" }, T0));
}

export function demoWorkspace(): Workspace {
  return must(loadDemoWorkspace(workspaceWithProfile(), T0));
}

export const MANUAL_PROJECT: ManualEntryInput = {
  kind: "project",
  title: "Garden planner",
  url: "https://example.com/garden",
  occurredAt: "2026-04-01",
  description: "A planner for allotment plots that I built for my local gardening club",
  technologies: "TypeScript, SQLite",
  targetProjectId: "",
};

export function manualWorkspace(input: ManualEntryInput = MANUAL_PROJECT): { ws: Workspace; reviewItemId: string; itemId: string } {
  const added = must(addManualItem(workspaceWithProfile(), input, T0));
  return { ws: added.workspace, reviewItemId: added.reviewItemId, itemId: added.itemId };
}
