import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/review" }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.ComponentProps<"a"> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { demoWorkspace, manualWorkspace } from "@/test/fixtures";
import { renderWithWorkspace, storedWorkspace } from "@/test/render";
import { WorkspaceGate } from "@/components/workspace/workspace-gate";
import { ReviewQueue } from "./review-queue";

function renderQueue(workspace = manualWorkspace().ws) {
  return renderWithWorkspace(
    <WorkspaceGate>
      <ReviewQueue />
    </WorkspaceGate>,
    { workspace },
  );
}

describe("ReviewQueue (T5.1–T5.6)", () => {
  it("shows status tabs with counts, defaulting to Needs review", async () => {
    renderQueue(demoWorkspace());
    const tab = await screen.findByRole("tab", { name: "Needs review, 8" });
    expect(tab).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Approved, 0" })).toBeInTheDocument();
    expect(screen.getAllByText("Demo data").length).toBeGreaterThan(0);
  });

  it("approves: the item leaves Needs review, the claim is saved, and the toast says it isn't published", async () => {
    const user = userEvent.setup();
    const { memory } = renderQueue();
    await user.click(await screen.findByRole("button", { name: /^Approve “/ }));

    expect(await screen.findByText("Approved and added to your portfolio draft. Not published.")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Approved, 1" })).toBeInTheDocument();
    const stored = storedWorkspace(memory);
    expect(stored.reviewItems[0].status).toBe("approved");
    expect(stored.portfolio.claims).toHaveLength(1);
    expect(stored.portfolio.publishing.status).toBe("not_published");
  });

  it("edits with the original kept, then reverts after confirmation", async () => {
    const user = userEvent.setup();
    const { memory } = renderQueue();
    await user.click(await screen.findByRole("button", { name: /^Edit “/ }));
    const field = screen.getByRole("textbox", { name: /Proposed text/ });
    await user.clear(field);
    await user.click(screen.getByRole("button", { name: "Save edit" }));
    expect(await screen.findByText("Proposed text is required.")).toBeInTheDocument();

    await user.type(field, "Built a garden planner.");
    await user.click(screen.getByRole("button", { name: "Save edit" }));
    expect(await screen.findByText("Edit saved")).toBeInTheDocument();
    expect(storedWorkspace(memory).reviewItems[0]).toMatchObject({ status: "edited", editedText: "Built a garden planner." });

    await user.click(screen.getByRole("tab", { name: "Edited, 1" }));
    const panel = screen.getByRole("tabpanel");
    await user.click(within(panel).getByRole("button", { name: "Show evidence and source" }));
    await user.click(within(panel).getByRole("button", { name: "Show original proposal" }));
    expect(within(panel).getByText(/A planner for allotment plots/, { selector: "blockquote" })).toBeInTheDocument();

    await user.click(within(panel).getByRole("button", { name: /^Revert edit/ }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toHaveFocus();
    await user.click(within(dialog).getByRole("button", { name: "Revert edit" }));
    await waitFor(() => expect(storedWorkspace(memory).reviewItems[0].status).toBe("needs_review"));
    expect(storedWorkspace(memory).reviewItems[0].editedText).toBeUndefined();
  });

  it("dismisses with a reason, keeps evidence, and restores", async () => {
    const user = userEvent.setup();
    const { memory } = renderQueue();
    await user.click(await screen.findByRole("button", { name: /^Dismiss “/ }));
    const dialog = await screen.findByRole("dialog", { name: "Dismiss this proposal?" });
    await user.type(within(dialog).getByRole("textbox", { name: /Reason/ }), "Duplicate");
    await user.click(within(dialog).getByRole("button", { name: "Dismiss proposal" }));

    expect(await screen.findByText("Dismissed. Evidence kept.")).toBeInTheDocument();
    const stored = storedWorkspace(memory);
    expect(stored.reviewItems[0]).toMatchObject({ status: "dismissed", dismissReason: "Duplicate" });
    expect(stored.evidence).toHaveLength(1);

    await user.click(screen.getByRole("tab", { name: "Dismissed, 1" }));
    expect(screen.getByText("Reason: Duplicate")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^Restore “/ }));
    await waitFor(() => expect(storedWorkspace(memory).reviewItems[0].status).toBe("needs_review"));
  });

  it("requires acknowledging a conflict before approving", async () => {
    const user = userEvent.setup();
    const { memory } = renderQueue(demoWorkspace());
    const article = (await screen.findAllByRole("article")).find((candidate) => within(candidate).queryByText("Conflicting evidence"))!;
    await user.click(within(article).getByRole("button", { name: /^Approve “/ }));
    const dialog = await screen.findByRole("dialog", { name: "Check the conflict before approving" });
    const approve = within(dialog).getByRole("button", { name: "Approve" });
    expect(approve).toBeDisabled();
    await user.click(within(dialog).getByRole("checkbox", { name: "I've checked this conflict" }));
    await user.click(approve);
    await waitFor(() =>
      expect(storedWorkspace(memory).reviewItems.filter((item) => item.status === "approved")).toHaveLength(1),
    );
  });

  it("shows no success message when saving fails", async () => {
    const user = userEvent.setup();
    const { memory } = renderQueue();
    memory.setItem = () => {
      throw new DOMException("full", "QuotaExceededError");
    };
    await user.click(await screen.findByRole("button", { name: /^Approve “/ }));
    expect(await screen.findByText("Changes could not be saved")).toBeInTheDocument();
    expect(screen.queryByText("Approved and added to your portfolio draft. Not published.")).not.toBeInTheDocument();
  });

  it("explains the empty queue", async () => {
    renderWithWorkspace(
      <WorkspaceGate>
        <ReviewQueue />
      </WorkspaceGate>,
    );
    expect(await screen.findByRole("heading", { name: "No proposals yet" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to Sources" })).toHaveAttribute("href", "/sources");
  });
});
