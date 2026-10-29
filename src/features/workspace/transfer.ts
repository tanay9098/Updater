import { workspaceSchema } from "@/lib/validation/domain";
import { toFieldErrors } from "@/lib/validation/field-errors";
import { err, ok, type Result } from "@/lib/validation/result";
import type { Workspace } from "@/types/domain";
import { migrateWorkspace } from "@/lib/data/migrations";
import { pruneReferences } from "./integrity";
import { appendActivity } from "./workspace";

/**
 * JSON export and import (FR-DATA-04). Import validates the whole file
 * first; a failure returns readable errors and changes nothing.
 */

export const EXPORT_FILE_PREFIX = "updater-workspace";

export function exportWorkspace(ws: Workspace): string {
  return `${JSON.stringify(ws, null, 2)}\n`;
}

export function exportFileName(now: string): string {
  return `${EXPORT_FILE_PREFIX}-${now.slice(0, 10)}.json`;
}

export type ImportErrorDetail = { path: string; message: string };

export type ParsedWorkspace = { workspace: Workspace; notices: string[] };

/**
 * Parses, migrates, and validates a workspace document. Shared by the
 * storage adapter (load) and import.
 */
export function parseWorkspaceDocument(raw: string): Result<ParsedWorkspace> & { details?: ImportErrorDetail[] } {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ...err("import_invalid", "The file isn't valid JSON."), details: [] };
  }
  const migrated = migrateWorkspace(json);
  if (!migrated.ok) return { ...migrated, details: [] };
  const parsed = workspaceSchema.safeParse(migrated.value);
  if (!parsed.success) {
    const details = Object.entries(toFieldErrors(parsed.error))
      .slice(0, 10)
      .map(([path, message]) => ({ path: path || "(document)", message }));
    return { ...err("import_invalid", "The data doesn't match the Updater workspace format."), details };
  }
  const pruned = pruneReferences(parsed.data);
  return ok({ workspace: pruned.workspace, notices: pruned.notices });
}

export function importWorkspace(raw: string, now: string): Result<ParsedWorkspace> & { details?: ImportErrorDetail[] } {
  const parsed = parseWorkspaceDocument(raw);
  if (!parsed.ok) return parsed;
  return ok({
    workspace: appendActivity(parsed.value.workspace, { type: "workspace_imported", summary: "Imported a workspace file" }, now),
    notices: parsed.value.notices,
  });
}
