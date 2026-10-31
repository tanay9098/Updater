import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

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
import { DEMO_PROVIDER, GITHUB_PROVIDER, MANUAL_PROVIDER, RSS_PROVIDER, presentStatus } from "@/lib/providers/registry";
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
      const { label, tone } = presentStatus(RSS_PROVIDER, status);
      const { unmount } = render(<StatusBadge tone={tone} label={label} />);
      expect(screen.getByText(expected[status])).toBeInTheDocument();
      unmount();
    }
    expect(presentStatus(MANUAL_PROVIDER, "connected").label).toBe("Local");
    expect(presentStatus(DEMO_PROVIDER, "not_connected").label).toBe("Not loaded");
    // A public import is not an authorized connection (rules.md §7.1.7).
    expect(presentStatus(GITHUB_PROVIDER, "connected").label).toBe("Public import");
    expect(presentStatus(GITHUB_PROVIDER, "not_connected").label).toBe("Not set up");
  });

  it("shows honest states: Local, Not loaded, Not set up, and Planned, with no connect buttons", async () => {
    renderSources();
    const manual = await screen.findByRole("region", { name: /Manual entries/ });
    expect(within(manual).getByText("Local")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: /Demo workspace/ })).getByText("Not loaded")).toBeInTheDocument();
    const github = screen.getByRole("region", { name: /GitHub/ });
    expect(within(github).getByText("Not set up")).toBeInTheDocument();
    expect(within(github).getByRole("button", { name: "Import repositories" })).toBeInTheDocument();
    expect(within(github).getByText(/can't confirm that the account is yours/)).toBeInTheDocument();
    const blog = screen.getByRole("region", { name: /Blog feeds/ });
    expect(within(blog).getByText("Planned")).toBeInTheDocument();
    expect(within(blog).getByText("Not available yet")).toBeInTheDocument();
    expect(within(blog).queryByRole("button")).not.toBeInTheDocument();
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

  describe("GitHub import (T10.1)", () => {
    const listing = {
      login: "octo-sample",
      repositories: [
        {
          item: {
            externalId: "repo:1",
            kind: "repository",
            title: "tidewatch",
            url: "https://github.com/octo-sample/tidewatch",
            occurredAt: "2026-02-03T04:05:06Z",
            metadata: { owner: "octo-sample", description: "Tide table summaries", language: "Go" },
          },
          pushedAt: "2026-10-01T00:00:00Z",
        },
        {
          item: {
            externalId: "repo:2",
            kind: "repository",
            title: "lanterns",
            url: "https://github.com/octo-sample/lanterns",
            occurredAt: "2026-02-03T04:05:06Z",
            metadata: { owner: "octo-sample", archived: true },
          },
        },
      ],
      skipped: { forks: 2, private: 0, invalid: 0 },
      truncated: false,
      rateLimit: { limit: 60, remaining: 59, resetAt: "2026-10-31T11:00:00.000Z" },
    };

    function stubFetch(...bodies: Array<{ status: number; body: unknown }>) {
      const queue = [...bodies];
      const fetch = vi.fn(async () => {
        const next = queue.shift() ?? { status: 500, body: {} };
        return new Response(JSON.stringify(next.body), { status: next.status, headers: { "content-type": "application/json" } });
      });
      vi.stubGlobal("fetch", fetch);
      return fetch;
    }

    afterEach(() => vi.unstubAllGlobals());

    it("validates the username, lists public repositories, and imports only the chosen ones", async () => {
      const user = userEvent.setup();
      const fetch = stubFetch({ status: 200, body: { ok: true, value: listing } });
      const { memory } = renderSources();
      await user.click(await screen.findByRole("button", { name: "Import repositories" }));
      const dialog = await screen.findByRole("dialog", { name: "Import from GitHub" });

      await user.type(within(dialog).getByRole("textbox", { name: /GitHub username/ }), "bad/name");
      await user.click(within(dialog).getByRole("button", { name: "Find repositories" }));
      expect(within(dialog).getByRole("textbox", { name: /GitHub username/ })).toHaveAttribute("aria-invalid", "true");
      expect(fetch).not.toHaveBeenCalled();

      await user.clear(within(dialog).getByRole("textbox", { name: /GitHub username/ }));
      await user.type(within(dialog).getByRole("textbox", { name: /GitHub username/ }), "@octo-sample");
      await user.click(within(dialog).getByRole("button", { name: "Find repositories" }));
      expect(await within(dialog).findByText("Found 2 public repositories owned by @octo-sample.")).toBeInTheDocument();
      expect(fetch).toHaveBeenCalledWith("/api/github/repositories?username=octo-sample", expect.anything());
      expect(within(dialog).getByText("2 forks left out.")).toBeInTheDocument();
      expect(within(dialog).getByText(/GitHub requests left for this server: 59 of 60/)).toBeInTheDocument();
      expect(within(dialog).getByText(/Archived/)).toBeInTheDocument();

      // Nothing is selected until the user chooses.
      expect(within(dialog).getByRole("button", { name: "Import repositories" })).toBeDisabled();
      await user.click(within(dialog).getByRole("checkbox", { name: "tidewatch" }));
      await user.click(within(dialog).getByRole("button", { name: "Import 1 repository" }));

      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(await screen.findByText("Imported 1 repository")).toBeInTheDocument();
      const stored = storedWorkspace(memory);
      expect(stored.sources).toEqual([expect.objectContaining({ providerId: "github", accountLabel: "octo-sample", status: "connected" })]);
      expect(stored.sourceItems.map((item) => item.title)).toEqual(["tidewatch"]);

      const github = screen.getByRole("region", { name: /GitHub/ });
      expect(within(github).getByText("Public import")).toBeInTheDocument();
      expect(within(github).getByText(/Importing public data for/)).toHaveTextContent("@octo-sample");
      expect(within(github).getByRole("button", { name: "Check for updates" })).toBeInTheDocument();
      expect(screen.queryByText("Connected")).not.toBeInTheDocument();
    });

    it("records a failed check on the source and keeps imported data", async () => {
      const user = userEvent.setup();
      stubFetch(
        { status: 200, body: { ok: true, value: listing } },
        {
          status: 429,
          body: { ok: false, error: { code: "rate_limited", message: "GitHub's request limit for this server was reached.", resetAt: "2026-10-31T11:00:00.000Z" } },
        },
      );
      const { memory } = renderSources();
      await user.click(await screen.findByRole("button", { name: "Import repositories" }));
      const dialog = await screen.findByRole("dialog", { name: "Import from GitHub" });
      await user.type(within(dialog).getByRole("textbox", { name: /GitHub username/ }), "octo-sample");
      await user.click(within(dialog).getByRole("button", { name: "Find repositories" }));
      await user.click(await within(dialog).findByRole("button", { name: "Select all new" }));
      await user.click(within(dialog).getByRole("button", { name: "Import 2 repositories" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

      // Opening "Check for updates" checks the stored account right away.
      await user.click(screen.getByRole("button", { name: "Check for updates" }));
      const check = await screen.findByRole("dialog", { name: "Check @octo-sample for updates" });
      expect(await within(check).findByText(/request limit for this server was reached\. Try again after/)).toBeInTheDocument();
      expect(within(check).getByRole("button", { name: "Try again" })).toBeInTheDocument();
      await waitFor(() => expect(storedWorkspace(memory).sources[0].status).toBe("needs_attention"));
      expect(storedWorkspace(memory).sources[0].lastSync).toMatchObject({ outcome: "rate_limited" });
      expect(storedWorkspace(memory).sourceItems).toHaveLength(2);

      await user.click(within(check).getByRole("button", { name: "Cancel" }));
      const github = screen.getByRole("region", { name: /GitHub/ });
      expect(within(github).getByText("Needs attention")).toBeInTheDocument();
      expect(within(github).getByText("GitHub's rate limit was reached")).toBeInTheDocument();
    });

    it("shows a signed-out failure without recording it on the source", async () => {
      const user = userEvent.setup();
      stubFetch({ status: 401, body: { error: "Sign in required." } });
      const { memory } = renderSources();
      await user.click(await screen.findByRole("button", { name: "Import repositories" }));
      const dialog = await screen.findByRole("dialog", { name: "Import from GitHub" });
      await user.type(within(dialog).getByRole("textbox", { name: /GitHub username/ }), "octo-sample");
      await user.click(within(dialog).getByRole("button", { name: "Find repositories" }));
      expect(await within(dialog).findByText("Your session has ended. Sign in again to import.")).toBeInTheDocument();
      expect(storedWorkspace(memory).sources).toEqual([]);
    });

    it("removes GitHub data only after a confirmation that states what is lost", async () => {
      const user = userEvent.setup();
      stubFetch({ status: 200, body: { ok: true, value: listing } });
      const { memory } = renderSources();
      await user.click(await screen.findByRole("button", { name: "Import repositories" }));
      const dialog = await screen.findByRole("dialog", { name: "Import from GitHub" });
      await user.type(within(dialog).getByRole("textbox", { name: /GitHub username/ }), "octo-sample");
      await user.click(within(dialog).getByRole("button", { name: "Find repositories" }));
      await user.click(await within(dialog).findByRole("checkbox", { name: "tidewatch" }));
      await user.click(within(dialog).getByRole("button", { name: "Import 1 repository" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

      await user.click(screen.getByRole("button", { name: "Remove GitHub data" }));
      const confirm = await screen.findByRole("alertdialog", { name: "Remove GitHub data?" });
      expect(confirm).toHaveTextContent("1 repository, 1 evidence record, and 2 proposals");
      expect(within(confirm).getByRole("button", { name: "Cancel" })).toHaveFocus();
      await user.click(within(confirm).getByRole("button", { name: "Remove GitHub data" }));
      await waitFor(() => expect(storedWorkspace(memory).sources).toEqual([]));
      expect(storedWorkspace(memory).sourceItems).toEqual([]);
      expect(await screen.findByText("Not set up")).toBeInTheDocument();
    });
  });
});
