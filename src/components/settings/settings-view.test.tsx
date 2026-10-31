import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/settings" }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.ComponentProps<"a"> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { exportWorkspace } from "@/features/workspace/transfer";
import { demoWorkspace, TEST_KEYS, workspaceWithProfile } from "@/test/fixtures";
import { renderWithWorkspace, storedWorkspace } from "@/test/render";
import { WorkspaceGate } from "@/components/workspace/workspace-gate";
import { SettingsView } from "./settings-view";

function renderSettings(workspace = demoWorkspace()) {
  return renderWithWorkspace(
    <WorkspaceGate>
      <SettingsView />
    </WorkspaceGate>,
    { workspace },
  );
}

describe("SettingsView (T8.1–T8.6)", () => {
  it("describes privacy accurately and mirrors source statuses", async () => {
    renderSettings();
    const privacy = await screen.findByRole("region", { name: "Privacy" });
    expect(privacy).toHaveTextContent("stored in this browser's local storage, under your account");
    expect(privacy).toHaveTextContent("no analytics");
    const integrations = screen.getByRole("region", { name: "Integrations" });
    expect(within(integrations).getAllByText("Planned")).toHaveLength(1);
    expect(within(integrations).getByText("Not set up")).toBeInTheDocument();
    expect(privacy).toHaveTextContent("sends only the username you enter");
    expect(within(integrations).getByText("Demo data")).toBeInTheDocument();
    expect(within(integrations).getByText("Local")).toBeInTheDocument();
  });

  it("a failed import changes nothing and lists the errors", async () => {
    const user = userEvent.setup();
    const { memory } = renderSettings();
    const before = memory.data.get(TEST_KEYS.workspace);
    expect(before).toBeDefined();
    const input = (await screen.findByRole("region", { name: "Data" })).querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, new File(['{"schemaVersion":1,"profile":42}'], "bad.json", { type: "application/json" }));
    expect(await screen.findByText("Import failed. Nothing was changed.")).toBeInTheDocument();
    expect(memory.data.get(TEST_KEYS.workspace)).toBe(before);
  });

  it("a valid import replaces the workspace only after confirmation", async () => {
    const user = userEvent.setup();
    const { memory } = renderSettings();
    const replacement = workspaceWithProfile();
    const input = (await screen.findByRole("region", { name: "Data" })).querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, new File([exportWorkspace(replacement)], "backup.json", { type: "application/json" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Replace workspace?" });
    expect(dialog).toHaveTextContent("6 source items");
    await user.click(within(dialog).getByRole("button", { name: "Replace workspace" }));
    await waitFor(() => expect(storedWorkspace(memory).sources).toEqual([]));
    expect(storedWorkspace(memory).profile?.name).toBe("Sam Rivera");
  });

  it("reset requires confirmation, names what is lost, and can be cancelled", async () => {
    const user = userEvent.setup();
    const { memory } = renderSettings();
    await user.click(await screen.findByRole("button", { name: "Reset workspace…" }));
    let dialog = await screen.findByRole("alertdialog", { name: "Reset workspace?" });
    expect(dialog).toHaveTextContent("8 proposals");
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(memory.data.has(TEST_KEYS.workspace)).toBe(true);

    await user.click(screen.getByRole("button", { name: "Reset workspace…" }));
    dialog = await screen.findByRole("alertdialog", { name: "Reset workspace?" });
    await user.click(within(dialog).getByRole("button", { name: "Reset workspace" }));
    await waitFor(() => expect(memory.data.has(TEST_KEYS.workspace)).toBe(false));
    expect(await screen.findByText("Workspace reset")).toBeInTheDocument();
  });

  it("edits profile basics", async () => {
    const user = userEvent.setup();
    const { memory } = renderSettings();
    const name = await screen.findByRole("textbox", { name: /Name/ });
    await user.clear(name);
    await user.type(name, "Robin Example");
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save profile" }));
    await waitFor(() => expect(storedWorkspace(memory).profile?.name).toBe("Robin Example"));
  });
});
