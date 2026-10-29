import { workspaceSchema } from "@/lib/validation/domain";
import { err, ok, type AppError, type Result } from "@/lib/validation/result";
import type { FieldErrors } from "@/lib/validation/field-errors";
import type { WorkspaceStorage } from "@/lib/data/storage";
import type { Workspace } from "@/types/domain";
import { createEmptyWorkspace } from "./workspace";

/**
 * Workspace store (architecture.md §7, §11). Holds the in-memory workspace,
 * applies pure domain operations, and saves after each successful one. The
 * save status always reflects the adapter's real outcome:
 *
 * - an operation that fails changes nothing;
 * - a result that wouldn't pass the load-time schema is refused, so a bug
 *   can never store data that fails to load;
 * - an operation that succeeds but can't be saved stays applied in memory
 *   (FR-ERR-02) and the save status becomes an error with a retry.
 *
 * It has no React dependency; `components/workspace` binds it with
 * `useSyncExternalStore`.
 */

export type SaveStatus =
  | { state: "idle" }
  | { state: "saved"; savedAt: string }
  | { state: "error"; error: AppError };

export type WorkspaceSnapshot =
  | { phase: "loading" }
  | { phase: "recovery"; error: AppError }
  | { phase: "ready"; workspace: Workspace; save: SaveStatus; notices: string[] };

export type ActionOutcome<T> =
  | { ok: true; value: T; savedAt: string }
  /** The operation was refused. Nothing changed. */
  | { ok: false; applied: false; error: AppError; fieldErrors?: FieldErrors }
  /** The change is in memory but couldn't be saved. */
  | { ok: false; applied: true; value: T; error: AppError };

type OperationResult<T> = Result<T> & { fieldErrors?: FieldErrors };
export type Operation<T> = (ws: Workspace, now: string) => OperationResult<T>;

export type WorkspaceStore = {
  getSnapshot(): WorkspaceSnapshot;
  subscribe(listener: () => void): () => void;
  /** Reads the stored workspace. Safe to call again (for example after another tab saved). */
  load(): void;
  apply<T extends Workspace | { workspace: Workspace }>(operation: Operation<T>): ActionOutcome<T>;
  /** Replaces the whole workspace (import). */
  replace(ws: Workspace, notices?: string[]): ActionOutcome<Workspace>;
  /** Deletes stored data and starts empty. */
  reset(): ActionOutcome<Workspace>;
  retrySave(): ActionOutcome<Workspace>;
  readRecovery(): string | null;
};

function workspaceOf(value: Workspace | { workspace: Workspace }): Workspace {
  return "workspace" in value ? value.workspace : value;
}

export function createWorkspaceStore(
  storage: WorkspaceStorage,
  clock: () => string = () => new Date().toISOString(),
): WorkspaceStore {
  let snapshot: WorkspaceSnapshot = { phase: "loading" };
  const listeners = new Set<() => void>();

  function set(next: WorkspaceSnapshot) {
    snapshot = next;
    for (const listener of listeners) listener();
  }

  function persist(ws: Workspace, notices: string[]): Result<{ savedAt: string }> {
    const saved = storage.save(ws, clock());
    set({
      phase: "ready",
      workspace: ws,
      notices,
      save: saved.ok ? { state: "saved", savedAt: saved.value.savedAt } : { state: "error", error: saved.error },
    });
    return saved;
  }

  function currentNotices(): string[] {
    return snapshot.phase === "ready" ? snapshot.notices : [];
  }

  return {
    getSnapshot: () => snapshot,

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    load() {
      const loaded = storage.load();
      if (loaded.ok) {
        set({
          phase: "ready",
          workspace: loaded.value.workspace ?? createEmptyWorkspace(),
          notices: loaded.value.notices,
          save: { state: "idle" },
        });
        return;
      }
      if (loaded.error.code === "storage_corrupt") {
        set({ phase: "recovery", error: loaded.error });
        return;
      }
      // Storage is blocked: the app still works for this visit, and says so.
      set({ phase: "ready", workspace: createEmptyWorkspace(), notices: [], save: { state: "error", error: loaded.error } });
    },

    apply(operation) {
      if (snapshot.phase !== "ready") {
        return { ok: false, applied: false, error: { code: "unexpected", message: "The workspace isn't loaded yet." } };
      }
      const result = operation(snapshot.workspace, clock());
      if (!result.ok) {
        return { ok: false, applied: false, error: result.error, ...(result.fieldErrors ? { fieldErrors: result.fieldErrors } : {}) };
      }
      // Never store a document that the next load would reject.
      const next = workspaceOf(result.value);
      const checked = workspaceSchema.safeParse(next);
      if (!checked.success) {
        const issue = checked.error.issues[0];
        return {
          ok: false,
          applied: false,
          error: {
            code: "unexpected",
            message: `The change was not applied because it would produce invalid data (${issue.path.join(".")}: ${issue.message}).`,
          },
        };
      }
      const saved = persist(next, currentNotices());
      return saved.ok
        ? { ok: true, value: result.value, savedAt: saved.value.savedAt }
        : { ok: false, applied: true, value: result.value, error: saved.error };
    },

    replace(ws, notices = []) {
      const saved = persist(ws, notices);
      return saved.ok
        ? { ok: true, value: ws, savedAt: saved.value.savedAt }
        : { ok: false, applied: true, value: ws, error: saved.error };
    },

    reset() {
      const cleared = storage.clear();
      if (!cleared.ok) return { ok: false, applied: false, error: cleared.error };
      const empty = createEmptyWorkspace();
      set({ phase: "ready", workspace: empty, notices: [], save: { state: "idle" } });
      return { ok: true, value: empty, savedAt: clock() };
    },

    retrySave() {
      if (snapshot.phase !== "ready") {
        return { ok: false, applied: false, error: { code: "unexpected", message: "The workspace isn't loaded yet." } };
      }
      const ws = snapshot.workspace;
      const saved = persist(ws, snapshot.notices);
      return saved.ok
        ? { ok: true, value: ws, savedAt: saved.value.savedAt }
        : { ok: false, applied: true, value: ws, error: saved.error };
    },

    readRecovery: () => storage.readRecovery(),
  };
}

/** Converts an outcome to a plain Result for callers that only need success or failure. */
export function outcomeToResult<T>(outcome: ActionOutcome<T>): Result<T> {
  return outcome.ok ? ok(outcome.value) : err(outcome.error.code, outcome.error.message);
}
