import { WORKSPACE_SCHEMA_VERSION } from "@/lib/validation/domain";
import { err, ok, type Result } from "@/lib/validation/result";

/**
 * Migrates a stored document to the current schema version before
 * validation (architecture.md §11). Version 1 is the first version, so the
 * only work today is recognizing it and refusing anything else. Future
 * versions add a step per version here.
 */
export function migrateWorkspace(input: unknown): Result<unknown> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return err("storage_corrupt", "The stored data isn't a workspace document.");
  }
  const version = (input as { schemaVersion?: unknown }).schemaVersion;
  if (version === WORKSPACE_SCHEMA_VERSION) return ok(input);
  if (typeof version === "number" && version > WORKSPACE_SCHEMA_VERSION) {
    return err(
      "storage_corrupt",
      `The data was saved by a newer version of Updater (format ${version}). This version reads format ${WORKSPACE_SCHEMA_VERSION}.`,
    );
  }
  return err("storage_corrupt", "The data has no recognizable format version.");
}
