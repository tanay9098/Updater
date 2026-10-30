import { err, ok, type AppError, type Result } from "@/lib/validation/result";
import type { Workspace } from "@/types/domain";
import type { WorkspaceScope } from "@/lib/auth/account";
import { parseWorkspaceDocument } from "@/features/workspace/transfer";

/**
 * Workspace persistence (architecture.md §11, D-003). The adapter is the
 * only code that knows the physical storage shape. A future
 * `ServerWorkspaceStorage` implements the same interface.
 *
 * Load: read → JSON parse → migrate → validate → prune dangling references.
 * When the stored value can't be used, the raw string is copied to the
 * recovery key before anything else happens, so the user can export it.
 *
 * Each signed-in account has its own pair of keys (D-030), so one account's
 * workspace is never loaded, shown, or overwritten for another. Local mode
 * (sign-in not configured) keeps the original unscoped keys.
 */

export const WORKSPACE_STORAGE_KEY = "updater:workspace:v1";
export const WORKSPACE_RECOVERY_KEY = "updater:workspace:recovery";

export type WorkspaceStorageKeys = { workspace: string; recovery: string };

const LOCAL_KEYS: WorkspaceStorageKeys = { workspace: WORKSPACE_STORAGE_KEY, recovery: WORKSPACE_RECOVERY_KEY };

export function workspaceStorageKeys(scope: WorkspaceScope): WorkspaceStorageKeys {
  if (scope.kind === "local") return LOCAL_KEYS;
  const account = encodeURIComponent(scope.accountId);
  return {
    workspace: `${WORKSPACE_STORAGE_KEY}:account:${account}`,
    recovery: `${WORKSPACE_RECOVERY_KEY}:account:${account}`,
  };
}

export type LoadedWorkspace = { workspace: Workspace | null; notices: string[] };

export interface WorkspaceStorage {
  load(): Result<LoadedWorkspace>;
  save(ws: Workspace, now: string): Result<{ savedAt: string }>;
  clear(): Result<void>;
  /** The raw value preserved by a failed load, if any. */
  readRecovery(): string | null;
}

/** Minimal Storage surface, so tests can pass an in-memory or failing stand-in. */
export type KeyValueStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const UNAVAILABLE: AppError = {
  code: "storage_unavailable",
  message: "This browser doesn't allow Updater to store data (storage may be blocked or in private mode).",
};

function storageError(error: unknown): AppError {
  const quota =
    error instanceof DOMException &&
    (error.name === "QuotaExceededError" || error.name === "NS_ERROR_DOM_QUOTA_REACHED");
  return quota ? { code: "storage_quota_exceeded", message: "Browser storage is full." } : UNAVAILABLE;
}

export function createWorkspaceStorage(
  getStorage: () => KeyValueStorage | null,
  keys: WorkspaceStorageKeys = LOCAL_KEYS,
): WorkspaceStorage {
  function resolve(): KeyValueStorage | null {
    try {
      return getStorage();
    } catch {
      return null;
    }
  }

  return {
    load() {
      const storage = resolve();
      if (!storage) return { ok: false, error: UNAVAILABLE };
      let raw: string | null;
      try {
        raw = storage.getItem(keys.workspace);
      } catch (error) {
        return { ok: false, error: storageError(error) };
      }
      if (raw === null) return ok({ workspace: null, notices: [] });

      const parsed = parseWorkspaceDocument(raw);
      if (!parsed.ok) {
        try {
          storage.setItem(keys.recovery, raw);
        } catch {
          // The raw value is still in the main key; reset is the only thing that removes it.
        }
        const detail = parsed.details?.[0];
        return err(
          "storage_corrupt",
          `The saved workspace couldn't be read. ${parsed.error.message}${detail ? ` (${detail.path}: ${detail.message})` : ""}`,
        );
      }
      return ok(parsed.value);
    },

    save(ws, now) {
      const storage = resolve();
      if (!storage) return { ok: false, error: UNAVAILABLE };
      try {
        storage.setItem(keys.workspace, JSON.stringify(ws));
        return ok({ savedAt: now });
      } catch (error) {
        return { ok: false, error: storageError(error) };
      }
    },

    clear() {
      const storage = resolve();
      if (!storage) return { ok: false, error: UNAVAILABLE };
      try {
        storage.removeItem(keys.workspace);
        storage.removeItem(keys.recovery);
        return ok(undefined);
      } catch (error) {
        return { ok: false, error: storageError(error) };
      }
    },

    readRecovery() {
      const storage = resolve();
      if (!storage) return null;
      try {
        return storage.getItem(keys.recovery) ?? storage.getItem(keys.workspace);
      } catch {
        return null;
      }
    },
  };
}

export function browserWorkspaceStorage(scope: WorkspaceScope = { kind: "local" }): WorkspaceStorage {
  return createWorkspaceStorage(
    () => (typeof window === "undefined" ? null : window.localStorage),
    workspaceStorageKeys(scope),
  );
}

/** In-memory storage for tests. */
export function createMemoryKeyValueStorage(initial: Record<string, string> = {}): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, String(value));
    },
    removeItem: (key) => {
      data.delete(key);
    },
  };
}
