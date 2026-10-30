import { describe, expect, it } from "vitest";
import { workspaceSchema } from "@/lib/validation/domain";
import { createEmptyWorkspace } from "@/features/workspace/workspace";
import { exportWorkspace, importWorkspace } from "@/features/workspace/transfer";
import { demoWorkspace, T0, T1 } from "@/test/fixtures";
import {
  createMemoryKeyValueStorage,
  createWorkspaceStorage,
  WORKSPACE_RECOVERY_KEY,
  WORKSPACE_STORAGE_KEY,
  workspaceStorageKeys,
  type KeyValueStorage,
} from "./storage";
import { migrateWorkspace } from "./migrations";

describe("WorkspaceStorage (T3.3)", () => {
  it("returns null when nothing is stored", () => {
    const storage = createWorkspaceStorage(() => createMemoryKeyValueStorage());
    expect(storage.load()).toEqual({ ok: true, value: { workspace: null, notices: [] } });
  });

  it("round-trips a valid workspace", () => {
    const memory = createMemoryKeyValueStorage();
    const storage = createWorkspaceStorage(() => memory);
    const ws = demoWorkspace();
    expect(storage.save(ws, T1)).toEqual({ ok: true, value: { savedAt: T1 } });
    const loaded = storage.load();
    expect(loaded.ok && loaded.value.workspace).toEqual(ws);
  });

  it("preserves corrupt JSON under the recovery key and reports storage_corrupt", () => {
    const memory = createMemoryKeyValueStorage({ [WORKSPACE_STORAGE_KEY]: "{not json" });
    const storage = createWorkspaceStorage(() => memory);
    const loaded = storage.load();
    expect(loaded.ok).toBe(false);
    if (!loaded.ok) expect(loaded.error.code).toBe("storage_corrupt");
    expect(memory.data.get(WORKSPACE_RECOVERY_KEY)).toBe("{not json");
    expect(storage.readRecovery()).toBe("{not json");
  });

  it("rejects a schema mismatch and keeps the raw value", () => {
    const raw = JSON.stringify({ ...createEmptyWorkspace(), profile: { name: 42 } });
    const memory = createMemoryKeyValueStorage({ [WORKSPACE_STORAGE_KEY]: raw });
    const loaded = createWorkspaceStorage(() => memory).load();
    expect(loaded.ok).toBe(false);
    if (!loaded.ok) expect(loaded.error.message).toContain("profile");
    expect(memory.data.get(WORKSPACE_RECOVERY_KEY)).toBe(raw);
  });

  it("refuses data from a newer format version", () => {
    expect(migrateWorkspace({ schemaVersion: 2 }).ok).toBe(false);
    expect(migrateWorkspace([]).ok).toBe(false);
    expect(migrateWorkspace({ schemaVersion: 1 }).ok).toBe(true);
  });

  it("reports quota and unavailable storage instead of throwing", () => {
    const full: KeyValueStorage = {
      getItem: () => null,
      setItem: () => {
        throw new DOMException("full", "QuotaExceededError");
      },
      removeItem: () => {},
    };
    const quota = createWorkspaceStorage(() => full).save(createEmptyWorkspace(), T0);
    expect(quota.ok).toBe(false);
    if (!quota.ok) expect(quota.error.code).toBe("storage_quota_exceeded");

    const blocked = createWorkspaceStorage(() => {
      throw new DOMException("denied", "SecurityError");
    });
    const loaded = blocked.load();
    expect(loaded.ok).toBe(false);
    if (!loaded.ok) expect(loaded.error.code).toBe("storage_unavailable");
    expect(blocked.save(createEmptyWorkspace(), T0).ok).toBe(false);
  });

  it("clear removes the workspace and the recovery copy", () => {
    const memory = createMemoryKeyValueStorage({ [WORKSPACE_STORAGE_KEY]: "x", [WORKSPACE_RECOVERY_KEY]: "y", "updater:theme": "dark" });
    expect(createWorkspaceStorage(() => memory).clear().ok).toBe(true);
    expect(Array.from(memory.data.keys())).toEqual(["updater:theme"]);
  });
});

describe("no secrets in persisted data (FR-DATA-03)", () => {
  const SECRET_KEY = /token|secret|password|apikey|api_key|credential|authorization/i;

  function keysOf(value: unknown, path = ""): string[] {
    if (Array.isArray(value)) return value.flatMap((entry, index) => keysOf(entry, `${path}[${index}]`));
    if (value && typeof value === "object") {
      return Object.entries(value).flatMap(([key, entry]) => [key, ...keysOf(entry, `${path}.${key}`)]);
    }
    return [];
  }

  it("a populated workspace has no secret-like field names", () => {
    expect(keysOf(demoWorkspace()).filter((key) => SECRET_KEY.test(key))).toEqual([]);
  });

  it("the schema rejects unknown fields such as a token", () => {
    const ws = demoWorkspace();
    expect(workspaceSchema.safeParse({ ...ws, githubToken: "ghp_x" }).success).toBe(false);
    expect(
      workspaceSchema.safeParse({ ...ws, sources: ws.sources.map((source) => ({ ...source, accessToken: "x" })) }).success,
    ).toBe(false);
  });
});

describe("export and import (FR-DATA-04)", () => {
  it("round-trips through JSON", () => {
    const ws = demoWorkspace();
    const imported = importWorkspace(exportWorkspace(ws), T1);
    expect(imported.ok).toBe(true);
    if (imported.ok) {
      expect({ ...imported.value.workspace, activity: [] }).toEqual({ ...ws, activity: [] });
      expect(imported.value.workspace.activity[0].type).toBe("workspace_imported");
    }
  });

  it("reports readable errors for invalid files", () => {
    const notJson = importWorkspace("hello", T1);
    expect(notJson.ok).toBe(false);
    if (!notJson.ok) expect(notJson.error.message).toBe("The file isn't valid JSON.");

    const wrongShape = importWorkspace(JSON.stringify({ ...createEmptyWorkspace(), resumes: "nope" }), T1);
    expect(wrongShape.ok).toBe(false);
    if (!wrongShape.ok) expect(wrongShape.details).toEqual([expect.objectContaining({ path: "resumes" })]);
  });

  it("rejects documents whose provenance chain is broken", () => {
    const ws = demoWorkspace();
    const broken = { ...ws, sourceItems: [] };
    expect(importWorkspace(JSON.stringify(broken), T1).ok).toBe(false);
  });

  it("drops dangling resume selections on import, with a notice", () => {
    const ws = createEmptyWorkspace();
    const withResume = {
      ...ws,
      resumes: [
        {
          id: "res_1",
          name: "Backend",
          targetRole: "Backend",
          summary: "",
          projectIds: ["proj_gone"],
          claimIds: [],
          skillIds: [],
          overrides: {},
          includeContact: true,
          createdAt: T0,
          updatedAt: T0,
        },
      ],
    };
    const imported = importWorkspace(JSON.stringify(withResume), T1);
    expect(imported.ok).toBe(true);
    if (imported.ok) {
      expect(imported.value.workspace.resumes[0].projectIds).toEqual([]);
      expect(imported.value.notices[0]).toContain("Backend");
    }
  });
});

describe("account-scoped workspace storage (D-030)", () => {
  const accountA = { kind: "account", accountId: "google:111" } as const;
  const accountB = { kind: "account", accountId: "google:222" } as const;

  it("gives each account its own keys and keeps local mode on the original keys", () => {
    expect(workspaceStorageKeys({ kind: "local" })).toEqual({
      workspace: WORKSPACE_STORAGE_KEY,
      recovery: WORKSPACE_RECOVERY_KEY,
    });
    const a = workspaceStorageKeys(accountA);
    const b = workspaceStorageKeys(accountB);
    expect(a.workspace).toBe("updater:workspace:v1:account:google%3A111");
    expect(new Set([a.workspace, a.recovery, b.workspace, b.recovery, WORKSPACE_STORAGE_KEY]).size).toBe(5);
  });

  it("never loads, overwrites, or clears another account's workspace", () => {
    const memory = createMemoryKeyValueStorage();
    const storageA = createWorkspaceStorage(() => memory, workspaceStorageKeys(accountA));
    const storageB = createWorkspaceStorage(() => memory, workspaceStorageKeys(accountB));
    const local = createWorkspaceStorage(() => memory);
    const ws = demoWorkspace();

    expect(storageA.save(ws, T1).ok).toBe(true);
    expect(storageB.load()).toEqual({ ok: true, value: { workspace: null, notices: [] } });
    expect(local.load()).toEqual({ ok: true, value: { workspace: null, notices: [] } });

    expect(storageB.save(createEmptyWorkspace(), T1).ok).toBe(true);
    expect(storageB.clear().ok).toBe(true);
    const loadedA = storageA.load();
    expect(loadedA.ok && loadedA.value.workspace).toEqual(ws);
  });

  it("keeps recovery data per account", () => {
    const keysA = workspaceStorageKeys(accountA);
    const memory = createMemoryKeyValueStorage({ [keysA.workspace]: "{not json" });
    const storageA = createWorkspaceStorage(() => memory, keysA);
    const storageB = createWorkspaceStorage(() => memory, workspaceStorageKeys(accountB));
    expect(storageA.load().ok).toBe(false);
    expect(memory.data.get(keysA.recovery)).toBe("{not json");
    expect(storageB.readRecovery()).toBeNull();
  });
});
