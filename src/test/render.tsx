import type { ReactElement, ReactNode } from "react";
import { render } from "@testing-library/react";
import { AccountProvider } from "@/components/account/account-provider";
import { ToastProvider } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WorkspaceProvider } from "@/components/workspace/workspace-provider";
import { createMemoryKeyValueStorage, createWorkspaceStorage } from "@/lib/data/storage";
import { createWorkspaceStore, type WorkspaceStore } from "@/features/workspace/store";
import type { AccountState } from "@/lib/auth/account";
import type { Workspace } from "@/types/domain";
import { TEST_ACCOUNT, TEST_KEYS } from "./fixtures";

/**
 * Renders UI inside the same providers the app uses, with an in-memory
 * workspace store (optionally pre-filled) instead of localStorage, signed in
 * as `TEST_ACCOUNT` unless another account state is given.
 */
export function renderWithWorkspace(
  ui: ReactElement,
  options: { workspace?: Workspace; account?: AccountState } = {},
) {
  const memory = createMemoryKeyValueStorage(
    options.workspace ? { [TEST_KEYS.workspace]: JSON.stringify(options.workspace) } : {},
  );
  const store: WorkspaceStore = createWorkspaceStore(createWorkspaceStorage(() => memory, TEST_KEYS));
  const wrapper = ({ children }: { children: ReactNode }) => (
    <TooltipProvider>
      <ToastProvider>
        <AccountProvider initial={options.account ?? TEST_ACCOUNT}>
          <WorkspaceProvider store={store}>{children}</WorkspaceProvider>
        </AccountProvider>
      </ToastProvider>
    </TooltipProvider>
  );
  return { ...render(ui, { wrapper }), store, memory };
}

export function storedWorkspace(memory: { data: Map<string, string> }): Workspace {
  return JSON.parse(memory.data.get(TEST_KEYS.workspace) ?? "null") as Workspace;
}
