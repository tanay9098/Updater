"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { browserWorkspaceStorage, WORKSPACE_STORAGE_KEY } from "@/lib/data/storage";
import {
  createWorkspaceStore,
  type ActionOutcome,
  type Operation,
  type WorkspaceSnapshot,
  type WorkspaceStore,
} from "@/features/workspace/store";
import { useToast, type ToastOptions } from "@/components/ui/toast";
import type { Workspace } from "@/types/domain";

const WorkspaceContext = createContext<WorkspaceStore | null>(null);

const LOADING: WorkspaceSnapshot = { phase: "loading" };

/**
 * Provides the workspace store to every route. The server and the first
 * client render show the loading state; the stored workspace is read after
 * hydration, so the server never sees workspace data (architecture.md §11).
 */
export function WorkspaceProvider({ children, store: injected }: { children: ReactNode; store?: WorkspaceStore }) {
  const [store] = useState(() => injected ?? createWorkspaceStore(browserWorkspaceStorage()));

  useEffect(() => {
    store.load();
    // Another tab saved: reload so this tab doesn't overwrite newer data with stale state.
    function onStorage(event: StorageEvent) {
      if (event.key === WORKSPACE_STORAGE_KEY || event.key === null) store.load();
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [store]);

  return <WorkspaceContext.Provider value={store}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspaceStore(): WorkspaceStore {
  const store = useContext(WorkspaceContext);
  if (!store) throw new Error("useWorkspaceStore must be used inside <WorkspaceProvider>.");
  return store;
}

export function useWorkspaceSnapshot(): WorkspaceSnapshot {
  const store = useWorkspaceStore();
  return useSyncExternalStore(store.subscribe, store.getSnapshot, () => LOADING);
}

const noopSubscribe = () => () => {};
const loadingSnapshot = () => LOADING;

/** Like `useWorkspaceSnapshot`, but reads "loading" outside a provider (shell components in isolation). */
export function useOptionalWorkspaceSnapshot(): WorkspaceSnapshot {
  const store = useContext(WorkspaceContext);
  return useSyncExternalStore(
    store?.subscribe ?? noopSubscribe,
    store?.getSnapshot ?? loadingSnapshot,
    loadingSnapshot,
  );
}

/** The loaded workspace. Only call inside <WorkspaceGate>, which renders children once it is ready. */
export function useWorkspace(): Workspace {
  const snapshot = useWorkspaceSnapshot();
  if (snapshot.phase !== "ready") throw new Error("useWorkspace must be used inside <WorkspaceGate>.");
  return snapshot.workspace;
}

type SuccessMessage<T> = ToastOptions | ((value: T) => ToastOptions) | null;

/**
 * Runs a domain operation and reports its real outcome (rules.md §7.2.6):
 * a success toast only after the store confirms the save, an error toast
 * when the change could not be saved. Refusals (validation, invalid
 * transitions) are returned for the caller to show next to their cause;
 * pass `announceRefusal` to also toast them.
 */
export function useWorkspaceAction() {
  const store = useWorkspaceStore();
  const { notify } = useToast();

  return useCallback(
    function run<T extends Workspace | { workspace: Workspace }>(
      operation: Operation<T>,
      options: { success?: SuccessMessage<T>; announceRefusal?: boolean } = {},
    ): ActionOutcome<T> {
      const outcome = store.apply(operation);
      if (outcome.ok) {
        const success = typeof options.success === "function" ? options.success(outcome.value) : options.success;
        if (success) notify({ tone: "success", ...success });
      } else if (outcome.applied) {
        notify(saveFailureToast(outcome.error.message));
      } else if (options.announceRefusal) {
        notify({ tone: "error", title: "That didn't work", description: outcome.error.message });
      }
      return outcome;
    },
    [notify, store],
  );
}

export function saveFailureToast(reason: string): ToastOptions {
  return {
    tone: "error",
    title: "Changes could not be saved",
    description: `${reason} The change is kept in this tab only and will be lost on reload. Use Retry in the save status.`,
  };
}
