import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({ push: vi.fn(), params: { resumeId: "" } }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: navigation.push }),
  useParams: () => navigation.params,
  usePathname: () => "/resumes",
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.ComponentProps<"a"> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { approveReviewItem } from "@/features/review/transitions";
import { createResume } from "@/features/resumes/drafts";
import { demoWorkspace, must, T1 } from "@/test/fixtures";
import { renderWithWorkspace, storedWorkspace } from "@/test/render";
import { WorkspaceGate } from "@/components/workspace/workspace-gate";
import type { Workspace } from "@/types/domain";
import { ResumeBuilderRoute } from "./resume-builder";
import { ResumeList } from "./resume-list";

function approvedWorkspace(): Workspace {
  let ws = demoWorkspace();
  for (const item of ws.reviewItems) ws = must(approveReviewItem(ws, item.id, { acknowledgeConflict: true }, T1)).workspace;
  return ws;
}

describe("ResumeList (T7.1)", () => {
  it("creates a resume for a target role and opens it", async () => {
    const user = userEvent.setup();
    const { memory } = renderWithWorkspace(
      <WorkspaceGate>
        <ResumeList />
      </WorkspaceGate>,
      { workspace: approvedWorkspace() },
    );
    expect(await screen.findByRole("heading", { name: "No resume drafts" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "New resume" }));
    const dialog = await screen.findByRole("dialog", { name: "New resume" });
    await user.click(within(dialog).getByRole("button", { name: "Create resume" }));
    expect(within(dialog).getByText("Target role is required.")).toBeInTheDocument();
    await user.type(within(dialog).getByRole("textbox", { name: /Target role/ }), "Backend Engineer");
    await user.click(within(dialog).getByRole("button", { name: "Create resume" }));
    await waitFor(() => expect(storedWorkspace(memory).resumes).toHaveLength(1));
    const id = storedWorkspace(memory).resumes[0].id;
    expect(navigation.push).toHaveBeenCalledWith(`/resumes/${id}`);
  });

  it("deletes a resume only after confirmation", async () => {
    const user = userEvent.setup();
    const created = must(createResume(approvedWorkspace(), { targetRole: "Backend Engineer", name: "" }, T1));
    const { memory } = renderWithWorkspace(
      <WorkspaceGate>
        <ResumeList />
      </WorkspaceGate>,
      { workspace: created.workspace },
    );
    await user.click(await screen.findByRole("button", { name: "Delete Backend Engineer" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Delete “Backend Engineer”?" });
    await user.click(within(dialog).getByRole("button", { name: "Delete resume" }));
    await waitFor(() => expect(storedWorkspace(memory).resumes).toEqual([]));
  });
});

describe("ResumeBuilder (T7.2–T7.6)", () => {
  function renderBuilder() {
    const created = must(createResume(approvedWorkspace(), { targetRole: "Backend Engineer", name: "" }, T1));
    navigation.params = { resumeId: created.resumeId };
    return renderWithWorkspace(<ResumeBuilderRoute />, { workspace: created.workspace });
  }

  it("suggests selections without adding text, and saves the draft", async () => {
    const user = userEvent.setup();
    const { memory } = renderBuilder();
    await user.click(await screen.findByRole("button", { name: "Suggest selections" }));
    expect(screen.getByText(/^Selected \d+ projects?/)).toHaveTextContent("Not saved yet.");
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /^Summary/ })).toHaveValue("");

    await user.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(storedWorkspace(memory).resumes[0].projectIds.length).toBeGreaterThan(0));
    expect(storedWorkspace(memory).resumes[0].summary).toBe("");
  });

  it("per-resume wording changes the preview, not the claim", async () => {
    const user = userEvent.setup();
    const { memory } = renderBuilder();
    const before = JSON.stringify((await waitFor(() => storedWorkspace(memory))).portfolio.claims);
    const option = await screen.findByRole("checkbox", { name: /Wrote “Designing offline sync/ });
    await user.click(option);
    const override = screen.getByRole("textbox", { name: /Wording for this resume only/ });
    await user.type(override, "Wrote about offline sync.");
    // Below the xl breakpoint (jsdom has no layout), the preview is a tab.
    await user.click(screen.getByRole("tab", { name: "Preview" }));
    const preview = screen.getByRole("region", { name: "Resume preview" });
    expect(within(preview).getByText(/Wrote about offline sync\./)).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Edit" }));
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(Object.values(storedWorkspace(memory).resumes[0].overrides)).toEqual(["Wrote about offline sync."]));
    expect(JSON.stringify(storedWorkspace(memory).portfolio.claims)).toBe(before);
  });

  it("prints through the browser dialog", async () => {
    const user = userEvent.setup();
    const print = vi.spyOn(window, "print").mockImplementation(() => {});
    renderBuilder();
    await user.click(await screen.findByRole("button", { name: "Print / Save as PDF" }));
    expect(print).toHaveBeenCalledOnce();
  });

  it("explains a missing resume", async () => {
    navigation.params = { resumeId: "res_missing" };
    renderWithWorkspace(<ResumeBuilderRoute />, { workspace: approvedWorkspace() });
    expect(await screen.findByRole("heading", { name: "Resume not found" })).toBeInTheDocument();
  });
});
