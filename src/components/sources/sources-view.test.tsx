import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/sources" }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.ComponentProps<"a"> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { demoWorkspace, workspaceWithProfile } from "@/test/fixtures";
import { renderWithWorkspace, storedWorkspace } from "@/test/render";
import { WorkspaceGate } from "@/components/workspace/workspace-gate";
import { SourcesView } from "./sources-view";
import { render } from "@testing-library/react";
import { SOURCE_STATUSES } from "@/lib/validation/domain";
import { DEMO_PROVIDER, GITHUB_PROVIDER, MANUAL_PROVIDER, presentStatus } from "@/lib/providers/registry";
import { StatusBadge } from "@/components/ui/status-badge";

function renderSources(workspace = workspaceWithProfile()) {
  return renderWithWorkspace(
    <WorkspaceGate>
      <SourcesView />
    </WorkspaceGate>,
    { workspace },
  );
}

describe("SourcesView (T4.2–T4.6)", () => {
  it("explains empty sources", async () => {
    renderSources();
    expect(
      await screen.findByText("No entries yet. Use “Add entry” to record a project, article, contribution, or achievement."),
    ).toBeInTheDocument();
    expect(screen.getByText("Not loaded. Nothing from this source is in your workspace.")).toBeInTheDocument();
    expect(screen.getByText("Not synchronized: entries are added manually.")).toBeInTheDocument();
  });

  it("renders a labeled badge for every source status, including ones no MVP provider produces", () => {
    const expected: Record<string, string> = {
      connected: "Connected",
      not_connected: "Not connected",
      needs_attention: "Needs attention",
      syncing: "Syncing",
      unavailable: "Unavailable",
      planned: "Planned",
      demo: "Demo data",
    };
    for (const status of SOURCE_STATUSES) {
      const { label, tone } = presentStatus(GITHUB_PROVIDER, status);
      const { unmount } = render(<StatusBadge tone={tone} label={label} />);
      expect(screen.getByText(expected[status])).toBeInTheDocument();
      unmount();
    }
    expect(presentStatus(MANUAL_PROVIDER, "connected").label).toBe("Local");
    expect(presentStatus(DEMO_PROVIDER, "not_connected").label).toBe("Not loaded");
  });

  it("shows honest states: Local, Not loaded, and Planned, with no connect buttons", async () => {
    renderSources();
    const manual = await screen.findByRole("region", { name: /Manual entries/ });
    expect(within(manual).getByText("Local")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: /Demo workspace/ })).getByText("Not loaded")).toBeInTheDocument();
    for (const name of [/GitHub/, /Blog feeds/]) {
      const region = screen.getByRole("region", { name });
      expect(within(region).getByText("Planned")).toBeInTheDocument();
      expect(within(region).getByText("Not available yet")).toBeInTheDocument();
      expect(within(region).queryByRole("button")).not.toBeInTheDocument();
    }
    expect(screen.queryByText("Connected")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /connect/i })).not.toBeInTheDocument();
  });

  it("adds a manual entry with inline validation, then lists it", async () => {
    const user = userEvent.setup();
    const { memory } = renderSources();
    await user.click(await screen.findByRole("button", { name: "Add entry" }));
    const dialog = await screen.findByRole("dialog", { name: "Add a manual entry" });
    await user.click(within(dialog).getByRole("button", { name: "Add entry" }));
    expect(within(dialog).getByText("2 fields need attention")).toBeInTheDocument();
    expect(within(dialog).getByRole("textbox", { name: /Title/ })).toHaveAttribute("aria-invalid", "true");

    await user.type(within(dialog).getByRole("textbox", { name: /Title/ }), "Talk at a meetup");
    await user.type(within(dialog).getByRole("textbox", { name: /Description/ }), "Gave a talk about offline sync");
    await user.type(within(dialog).getByRole("textbox", { name: /Link/ }), "data:text/html,hi");
    await user.click(within(dialog).getByRole("button", { name: "Add entry" }));
    expect(await within(dialog).findByText(/full web address/)).toBeInTheDocument();

    await user.clear(within(dialog).getByRole("textbox", { name: /Link/ }));
    await user.click(within(dialog).getByRole("button", { name: "Add entry" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(await screen.findByText("Entry added")).toBeInTheDocument();
    expect(screen.getByText("Talk at a meetup")).toBeInTheDocument();
    expect(storedWorkspace(memory).evidence[0].verification).toBe("user_asserted");
  });

  it("loads demo data on request and labels it", async () => {
    const user = userEvent.setup();
    renderSources();
    await user.click(await screen.findByRole("button", { name: "Load demo data" }));
    expect(await screen.findByText("Your workspace includes demo data")).toBeInTheDocument();
    const demo = screen.getByRole("region", { name: /Demo workspace/ });
    await user.click(within(demo).getByRole("button", { name: /Show 6 items/ }));
    // The status badge plus one label per item.
    expect(within(demo).getAllByText("Demo data")).toHaveLength(7);
    const links = within(demo).getAllByRole("link", { name: /Open source/ });
    for (const link of links) {
      expect(link).toHaveAttribute("href", expect.stringMatching(/^https:\/\/example\.com\//));
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
      expect(link).toHaveAttribute("target", "_blank");
    }
  });

  it("removes demo data only after a confirmation that states what is lost", async () => {
    const user = userEvent.setup();
    const { memory } = renderSources(demoWorkspace());
    await user.click(await screen.findByRole("button", { name: "Remove demo data" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Remove demo data?" });
    expect(dialog).toHaveTextContent("6 items");
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toHaveFocus();
    await user.click(within(dialog).getByRole("button", { name: "Remove demo data" }));
    await waitFor(() => expect(storedWorkspace(memory).sources).toEqual([]));
    expect(await screen.findByText("Not loaded")).toBeInTheDocument();
  });
});
