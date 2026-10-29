import { describe, expect, it } from "vitest";
import {
  createMemoryKeyValueStorage,
  createWorkspaceStorage,
  WORKSPACE_STORAGE_KEY,
  type KeyValueStorage,
} from "@/lib/data/storage";
import { err } from "@/lib/validation/result";
import { approveReviewItem } from "@/features/review/transitions";
import { addManualItem } from "@/features/sources/manual";
import { updateProfile } from "@/features/profile/profile";
import { MANUAL_PROJECT, T0, T1 } from "@/test/fixtures";
import { createWorkspaceStore } from "./store";

const clock = () => T1;

function setup(initial: Record<string, string> = {}) {
  const memory = createMemoryKeyValueStorage(initial);
  const store = createWorkspaceStore(createWorkspaceStorage(() => memory), clock);
  store.load();
  return { memory, store };
}

const profile = { name: "Sam", headline: "", intro: "", location: "", email: "" };

describe("workspace store (T3.4, integration with the storage adapter)", () => {
  it("starts empty, applies an operation, and saves it", () => {
    const { memory, store } = setup();
    expect(store.getSnapshot()).toMatchObject({ phase: "ready", save: { state: "idle" } });
    const outcome = store.apply((ws, now) => updateProfile(ws, profile, now));
    expect(outcome).toMatchObject({ ok: true, savedAt: T1 });
    expect(store.getSnapshot()).toMatchObject({ phase: "ready", save: { state: "saved", savedAt: T1 } });
    expect(JSON.parse(memory.data.get(WORKSPACE_STORAGE_KEY)!).profile.name).toBe("Sam");
  });

  it("edits persist across a reload (a new store over the same storage)", () => {
    const { memory, store } = setup();
    store.apply((ws, now) => updateProfile(ws, profile, now));
    store.apply((ws, now) => addManualItem(ws, MANUAL_PROJECT, now));
    const reloaded = createWorkspaceStore(createWorkspaceStorage(() => memory), clock);
    reloaded.load();
    const snapshot = reloaded.getSnapshot();
    expect(snapshot.phase).toBe("ready");
    if (snapshot.phase === "ready") {
      expect(snapshot.workspace.profile?.name).toBe("Sam");
      expect(snapshot.workspace.reviewItems).toHaveLength(1);
    }
  });

  it("approving through the store puts the claim in the saved portfolio", () => {
    const { memory, store } = setup();
    const added = store.apply((ws, now) => addManualItem(ws, MANUAL_PROJECT, now));
    if (!added.ok) throw new Error("setup failed");
    const approved = store.apply((ws, now) => approveReviewItem(ws, added.value.reviewItemId, {}, now));
    expect(approved.ok).toBe(true);
    const stored = JSON.parse(memory.data.get(WORKSPACE_STORAGE_KEY)!);
    expect(stored.portfolio.claims).toHaveLength(1);
    expect(stored.portfolio.publishing).toEqual({ publisherId: null, status: "not_published" });
  });

  it("a refused operation changes nothing and saves nothing", () => {
    const { memory, store } = setup();
    const before = store.getSnapshot();
    const outcome = store.apply(() => err("invalid_transition", "No."));
    expect(outcome).toMatchObject({ ok: false, applied: false, error: { code: "invalid_transition" } });
    expect(store.getSnapshot()).toBe(before);
    expect(memory.data.has(WORKSPACE_STORAGE_KEY)).toBe(false);
  });

  it("refuses a result that would fail validation on the next load", () => {
    const { memory, store } = setup();
    const outcome = store.apply((ws) => ({ ok: true, value: { ...ws, profile: { ...ws.profile!, name: "" } } }));
    expect(outcome).toMatchObject({ ok: false, applied: false });
    expect(memory.data.has(WORKSPACE_STORAGE_KEY)).toBe(false);
  });

  it("keeps the change in memory and reports the error when saving fails (FR-ERR-02)", () => {
    let full = true;
    const memory = createMemoryKeyValueStorage();
    const flaky: KeyValueStorage = {
      ...memory,
      setItem: (key, value) => {
        if (full) throw new DOMException("full", "QuotaExceededError");
        memory.setItem(key, value);
      },
    };
    const store = createWorkspaceStore(createWorkspaceStorage(() => flaky), clock);
    store.load();
    const outcome = store.apply((ws, now) => updateProfile(ws, profile, now));
    expect(outcome).toMatchObject({ ok: false, applied: true, error: { code: "storage_quota_exceeded" } });
    const snapshot = store.getSnapshot();
    expect(snapshot.phase === "ready" && snapshot.workspace.profile?.name).toBe("Sam");
    expect(snapshot.phase === "ready" && snapshot.save.state).toBe("error");

    full = false;
    expect(store.retrySave()).toMatchObject({ ok: true });
    expect(JSON.parse(memory.data.get(WORKSPACE_STORAGE_KEY)!).profile.name).toBe("Sam");
  });

  it("enters recovery for corrupt data, and reset starts empty", () => {
    const { memory, store } = setup({ [WORKSPACE_STORAGE_KEY]: "corrupt" });
    expect(store.getSnapshot()).toMatchObject({ phase: "recovery", error: { code: "storage_corrupt" } });
    expect(store.readRecovery()).toBe("corrupt");
    expect(store.reset()).toMatchObject({ ok: true });
    expect(store.getSnapshot()).toMatchObject({ phase: "ready", workspace: { profile: null } });
    expect(memory.data.size).toBe(0);
  });

  it("notifies subscribers on change", () => {
    const { store } = setup();
    let calls = 0;
    const unsubscribe = store.subscribe(() => {
      calls += 1;
    });
    store.apply((ws, now) => updateProfile(ws, profile, now));
    unsubscribe();
    store.apply((ws, now) => updateProfile(ws, { ...profile, name: "Kim" }, now));
    expect(calls).toBe(1);
  });

  it("works for the visit when storage is blocked, and says so", () => {
    const store = createWorkspaceStore(createWorkspaceStorage(() => null), () => T0);
    store.load();
    expect(store.getSnapshot()).toMatchObject({ phase: "ready", save: { state: "error", error: { code: "storage_unavailable" } } });
  });
});
