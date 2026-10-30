import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/settings" }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.ComponentProps<"a"> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { signOutOfAccount } from "@/lib/auth/actions";
import type { AccountState } from "@/lib/auth/account";
import {
  createMemoryKeyValueStorage,
  createWorkspaceStorage,
  LEGACY_WORKSPACE_KEYS,
  WORKSPACE_STORAGE_KEY,
  workspaceStorageKeys,
} from "@/lib/data/storage";
import { updateProfile } from "@/features/profile/profile";
import { createEmptyWorkspace } from "@/features/workspace/workspace";
import { must, T0, workspaceWithProfile } from "@/test/fixtures";
import { renderWithWorkspace, storedWorkspace } from "@/test/render";
import { ToastProvider } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AccountSettings } from "@/components/settings/account-settings";
import { SettingsView } from "@/components/settings/settings-view";
import { WorkspaceGate } from "@/components/workspace/workspace-gate";
import { useWorkspace, WorkspaceProvider } from "@/components/workspace/workspace-provider";
import { AccountMenu } from "./account-menu";
import { AccountProvider, type AccountSnapshot } from "./account-provider";

const ALICE: AccountState = { status: "signed_in", user: { id: "google:111", name: "Alice Example", email: "alice@example.com" } };
const BOB: AccountState = { status: "signed_in", user: { id: "google:222", name: "Bob Example", email: "bob@example.com" } };

function workspaceNamed(name: string) {
  return must(updateProfile(createEmptyWorkspace(), { name, headline: "", intro: "", location: "", email: "" }, T0));
}

function storeInBrowser(key: string, name: string) {
  window.localStorage.setItem(key, JSON.stringify(workspaceNamed(name)));
}

function ProfileName() {
  const ws = useWorkspace();
  return <p data-testid="profile-name">{ws.profile?.name ?? "No profile"}</p>;
}

/** The app's real providers, with the account answer stubbed instead of fetched. */
function renderApp(ui: ReactNode, load: () => Promise<AccountSnapshot>) {
  return render(
    <TooltipProvider>
      <ToastProvider>
        <AccountProvider load={load}>
          <WorkspaceProvider>{ui}</WorkspaceProvider>
        </AccountProvider>
      </ToastProvider>
    </TooltipProvider>,
  );
}

const ready = (state: AccountState) => async (): Promise<AccountSnapshot> => ({ phase: "ready", state });

describe("account-scoped workspaces (T10.5, D-030, D-031)", () => {
  it("opens only the signed-in account's workspace", async () => {
    storeInBrowser(workspaceStorageKeys({ kind: "account", accountId: "google:111" }).workspace, "Alice Example");
    storeInBrowser(workspaceStorageKeys({ kind: "account", accountId: "google:222" }).workspace, "Bob Example");
    storeInBrowser(WORKSPACE_STORAGE_KEY, "Pre-sign-in user");

    renderApp(
      <WorkspaceGate>
        <ProfileName />
      </WorkspaceGate>,
      ready(BOB),
    );
    expect(await screen.findByTestId("profile-name")).toHaveTextContent("Bob Example");
    expect(screen.queryByText("Alice Example")).not.toBeInTheDocument();
    expect(screen.queryByText("Pre-sign-in user")).not.toBeInTheDocument();
  });

  it("starts a new account with an empty workspace and saves under that account only", async () => {
    storeInBrowser(workspaceStorageKeys({ kind: "account", accountId: "google:111" }).workspace, "Alice Example");
    renderApp(
      <WorkspaceGate>
        <ProfileName />
      </WorkspaceGate>,
      ready(BOB),
    );
    expect(await screen.findByTestId("profile-name")).toHaveTextContent("No profile");
  });

  it("closes the workspace when the account signs out in another tab, and opens the next account's", async () => {
    storeInBrowser(workspaceStorageKeys({ kind: "account", accountId: "google:111" }).workspace, "Alice Example");
    storeInBrowser(workspaceStorageKeys({ kind: "account", accountId: "google:222" }).workspace, "Bob Example");
    let answer: AccountState = ALICE;
    renderApp(
      <WorkspaceGate>
        <ProfileName />
      </WorkspaceGate>,
      async () => ({ phase: "ready", state: answer }),
    );
    expect(await screen.findByTestId("profile-name")).toHaveTextContent("Alice Example");

    answer = { status: "signed_out" };
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(await screen.findByRole("heading", { name: "You're signed out" })).toBeInTheDocument();
    expect(screen.queryByText("Alice Example")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/sign-in");

    answer = BOB;
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(await screen.findByTestId("profile-name")).toHaveTextContent("Bob Example");
  });

  it("keeps the workspace closed while the account is unknown or can't be checked", async () => {
    storeInBrowser(WORKSPACE_STORAGE_KEY, "Pre-sign-in user");
    renderApp(
      <WorkspaceGate>
        <ProfileName />
      </WorkspaceGate>,
      async () => ({ phase: "error", message: "The server couldn't be reached." }),
    );
    expect(screen.getByRole("status")).toHaveTextContent("Loading your workspace…");
    expect(await screen.findByRole("alert")).toHaveTextContent("Your sign-in couldn't be checked");
    expect(screen.queryByTestId("profile-name")).not.toBeInTheDocument();
  });

  it("explains missing sign-in configuration instead of opening anything", async () => {
    storeInBrowser(WORKSPACE_STORAGE_KEY, "Pre-sign-in user");
    renderApp(
      <WorkspaceGate>
        <ProfileName />
      </WorkspaceGate>,
      ready({ status: "unavailable" }),
    );
    expect(await screen.findByRole("heading", { name: "Sign-in isn't available" })).toBeInTheDocument();
    expect(screen.queryByTestId("profile-name")).not.toBeInTheDocument();
  });

  it("never opens the unowned pre-sign-in workspace, even for a new account", async () => {
    storeInBrowser(WORKSPACE_STORAGE_KEY, "Pre-sign-in user");
    renderApp(
      <WorkspaceGate>
        <ProfileName />
      </WorkspaceGate>,
      ready(ALICE),
    );
    expect(await screen.findByTestId("profile-name")).toHaveTextContent("No profile");
  });
});

describe("AccountMenu", () => {
  it("shows the account and signs out", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {}); // jsdom can't navigate on location.assign
    const user = userEvent.setup();
    renderApp(<AccountMenu />, ready(ALICE));
    await user.click(await screen.findByRole("button", { name: "Account: Alice Example" }));
    const menu = screen.getByRole("menu");
    expect(menu).toHaveTextContent("alice@example.com");
    expect(within(menu).getByRole("menuitem", { name: "Account settings" })).toHaveAttribute("href", "/settings#account");
    await user.click(within(menu).getByRole("menuitem", { name: "Sign out" }));
    await waitFor(() => expect(signOutOfAccount).toHaveBeenCalledOnce());
  });

  it("renders nothing while signed out", async () => {
    renderApp(<AccountMenu />, ready({ status: "signed_out" }));
    await act(async () => {});
    expect(screen.queryByRole("button", { name: /^Account/ })).not.toBeInTheDocument();
  });
});

describe("Settings → Account", () => {
  it("names the signed-in account and describes privacy for accounts", async () => {
    renderWithWorkspace(
      <WorkspaceGate>
        <SettingsView />
      </WorkspaceGate>,
      { workspace: workspaceWithProfile(), account: ALICE },
    );
    const account = await screen.findByRole("region", { name: "Account" });
    expect(account).toHaveTextContent("Alice Example · alice@example.com");
    expect(within(account).getByRole("button", { name: "Sign out" })).toBeInTheDocument();
    const privacy = screen.getByRole("region", { name: "Privacy" });
    expect(privacy).toHaveTextContent("under your account");
    expect(privacy).toHaveTextContent("Other accounts signing in on this browser can't open your workspace");
    expect(privacy).not.toHaveTextContent("No account is needed");
  });

  it("moves a workspace saved before sign-in into the account and removes the unowned copy", async () => {
    const user = userEvent.setup();
    const legacyMemory = createMemoryKeyValueStorage({ [WORKSPACE_STORAGE_KEY]: JSON.stringify(workspaceNamed("Pre-sign-in user")) });
    const legacy = createWorkspaceStorage(() => legacyMemory, LEGACY_WORKSPACE_KEYS);
    const { memory } = renderWithWorkspace(
      <WorkspaceGate>
        <AccountSettings localStorage={legacy} />
      </WorkspaceGate>,
      { account: ALICE },
    );

    expect(await screen.findByRole("heading", { name: "Workspace saved before sign-in" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Move into this account…" }));
    const dialog = screen.getByRole("alertdialog", { name: "Move workspace into this account?" });
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toHaveFocus();
    await user.click(within(dialog).getByRole("button", { name: "Move workspace" }));

    await waitFor(() => expect(storedWorkspace(memory).profile?.name).toBe("Pre-sign-in user"));
    expect(legacyMemory.data.has(WORKSPACE_STORAGE_KEY)).toBe(false);
    expect(screen.queryByRole("heading", { name: "Workspace saved before sign-in" })).not.toBeInTheDocument();
  });

  it("offers nothing to move when there is no workspace from before sign-in", async () => {
    renderWithWorkspace(
      <WorkspaceGate>
        <AccountSettings localStorage={createWorkspaceStorage(() => createMemoryKeyValueStorage(), LEGACY_WORKSPACE_KEYS)} />
      </WorkspaceGate>,
      { account: ALICE },
    );
    expect(await screen.findByRole("heading", { name: "Signed in with Google" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Workspace saved before sign-in" })).not.toBeInTheDocument();
  });
});
