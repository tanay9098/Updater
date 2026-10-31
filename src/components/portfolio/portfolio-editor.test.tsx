import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/portfolio",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.ComponentProps<"a"> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { approveReviewItem } from "@/features/review/transitions";
import { demoWorkspace, must, T1 } from "@/test/fixtures";
import { stubUpdaterRoutes } from "@/test/publishing";
import { renderWithWorkspace, storedWorkspace } from "@/test/render";
import { WorkspaceGate } from "@/components/workspace/workspace-gate";
import { PortfolioEditor } from "./portfolio-editor";

function workspaceWithApprovedPullRequest() {
  const ws = demoWorkspace();
  const pr = ws.reviewItems.find((item) => item.kind === "add_claim")!;
  return must(approveReviewItem(ws, pr.id, {}, T1)).workspace;
}

function renderEditor(workspace = workspaceWithApprovedPullRequest()) {
  return renderWithWorkspace(
    <WorkspaceGate>
      <PortfolioEditor />
    </WorkspaceGate>,
    { workspace },
  );
}

describe("PortfolioEditor (T6.1–T6.6)", () => {
  beforeEach(() => {
    // This server has no GitHub App configured (T10.9).
    stubUpdaterRoutes({ "GET /api/portfolio/site": { body: { state: "unavailable" } } });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("separates draft, preview, and publication states; Publish is disabled with a reason", async () => {
    const user = userEvent.setup();
    renderEditor();
    expect(await screen.findByText("Not published")).toBeInTheDocument();
    const publish = screen.getByRole("button", { name: "Publish" });
    expect(publish).toBeDisabled();
    await waitFor(() => expect(publish).toHaveAccessibleDescription(/Publishing isn't set up on this server/));
    await user.click(screen.getByRole("tab", { name: "Preview" }));
    expect(screen.getByRole("heading", { name: "Local preview: not published" })).toBeInTheDocument();
    expect(screen.getByText("Only you can see this. It shows your saved draft, not unsaved edits.")).toBeInTheDocument();
  });

  it("shows unsaved edits, then saves the profile", async () => {
    const user = userEvent.setup();
    const { memory } = renderEditor();
    await user.type(await screen.findByRole("textbox", { name: /Introduction/ }), "I build tools.");
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save profile" }));
    expect(await screen.findByText("Profile saved")).toBeInTheDocument();
    expect(storedWorkspace(memory).profile?.intro).toBe("I build tools.");
    expect(screen.queryByText("Unsaved changes")).not.toBeInTheDocument();
  });

  it("editing a source claim marks it Edited from source and keeps evidence", async () => {
    const user = userEvent.setup();
    const { memory } = renderEditor();
    const other = await screen.findByRole("region", { name: "Other achievements" });
    expect(within(other).getByText("Source")).toBeInTheDocument();
    expect(within(other).getByText("Demo data")).toBeInTheDocument();
    await user.click(within(other).getByRole("button", { name: /^Edit “/ }));
    expect(within(other).getByText("Will be marked Edited from source. Evidence links are kept.")).toBeInTheDocument();
    const field = within(other).getByRole("textbox", { name: /Achievement/ });
    await user.clear(field);
    await user.type(field, "Added retries to a cache client.");
    await user.click(within(other).getByRole("button", { name: "Save achievement" }));
    await waitFor(() =>
      expect(storedWorkspace(memory).portfolio.claims[0]).toMatchObject({
        text: "Added retries to a cache client.",
        origin: "edited_from_source",
        evidenceIds: [expect.any(String)],
      }),
    );
    expect(await within(other).findByText("Edited from source")).toBeInTheDocument();
  });

  it("lists a claim's evidence with its source", async () => {
    const user = userEvent.setup();
    renderEditor();
    const other = await screen.findByRole("region", { name: "Other achievements" });
    await user.click(within(other).getByRole("button", { name: /^Evidence \(1\)/ }));
    const dialog = await screen.findByRole("dialog", { name: "Evidence" });
    expect(within(dialog).getByText("From source")).toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: /Open source/ })).toHaveAttribute("href", expect.stringContaining("example.com"));
  });

  it("adds a project, then deletes it after confirmation", async () => {
    const user = userEvent.setup();
    const { memory } = renderEditor();
    await user.click(await screen.findByRole("button", { name: "Add project" }));
    await user.type(screen.getByRole("textbox", { name: /Project name/ }), "Recipe box");
    await user.click(screen.getAllByRole("button", { name: "Add project" }).at(-1)!);
    await waitFor(() => expect(storedWorkspace(memory).portfolio.projects.map((project) => project.name)).toEqual(["Recipe box"]));

    await user.click(screen.getByRole("button", { name: "Delete Recipe box" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Delete “Recipe box”?" });
    await user.click(within(dialog).getByRole("button", { name: "Delete project" }));
    await waitFor(() => expect(storedWorkspace(memory).portfolio.projects).toEqual([]));
  });
});
