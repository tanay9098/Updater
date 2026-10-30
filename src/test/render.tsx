import type { ReactElement, ReactNode } from "react";
import { render } from "@testing-library/react";
import { AccountProvider } from "@/components/account/account-provider";
import { ToastProvider } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WorkspaceProvider } from "@/components/workspace/workspace-provider";
import { createMemoryKeyValueStorage, createWorkspaceStorage, WORKSPACE_STORAGE_KEY } from "@/lib/data/storage";
import { createWorkspaceStore, type WorkspaceStore } from "@/features/workspace/store";
import type { AccountState } from "@/lib/auth/account";
import type { Workspace } from "@/types/domain";

/**
 * Renders UI inside the same providers the app uses, with an in-memory
 * workspace store (optionally pre-filled) instead of localStorage. The
 * account defaults to local mode (sign-in not configured).
 */
export function renderWithWorkspace(
  ui: ReactElement,
  options: { workspace?: Workspace; account?: AccountState } = {},
) {
  const memory = createMemoryKeyValueStorage(
    options.workspace ? { [WORKSPACE_STORAGE_KEY]: JSON.stringify(options.workspace) } : {},
  );
  const store: WorkspaceStore = createWorkspaceStore(createWorkspaceStorage(() => memory));
  const wrapper = ({ children }: { children: ReactNode }) => (
    <TooltipProvider>
      <ToastProvider>
        <AccountProvider initial={options.account ?? { status: "local" }}>
          <WorkspaceProvider store={store}>{children}</WorkspaceProvider>
        </AccountProvider>
      </ToastProvider>
    </TooltipProvider>
  );
  return { ...render(ui, { wrapper }), store, memory };
}

export function storedWorkspace(memory: { data: Map<string, string> }): Workspace {
  return JSON.parse(memory.data.get(WORKSPACE_STORAGE_KEY) ?? "null") as Workspace;
}
