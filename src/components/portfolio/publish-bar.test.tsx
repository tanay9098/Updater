import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/portfolio",
  useSearchParams: () => new URLSearchParams(),
}));

import { startPublishing } from "@/features/publishing/state";
import { must, T0, workspaceWithProfile } from "@/test/fixtures";
import { READY_SITE, SHA_B, stubUpdaterRoutes } from "@/test/publishing";
import { renderWithWorkspace, storedWorkspace } from "@/test/render";
import { WorkspaceGate } from "@/components/workspace/workspace-gate";
import { PublishBar } from "./publish-bar";

function renderBar(workspace = workspaceWithProfile()) {
  return renderWithWorkspace(
    <WorkspaceGate>
      <PublishBar />
    </WorkspaceGate>,
    { workspace },
  );
}

/** The Publish button once the site's status has loaded (it is disabled while loading). */
async function enabledPublish() {
  await waitFor(() => expect(screen.getByRole("button", { name: "Publish" })).toBeEnabled());
  return screen.getByRole("button", { name: "Publish" });
}

const PUBLISHED = {
  ok: true,
  value: {
    repository: "octo-sample/octo-sample.github.io",
    commitSha: SHA_B,
    siteUrl: "https://octo-sample.github.io/",
    settingsUrl: "https://github.com/octo-sample/octo-sample.github.io/settings/pages",
    pagesSetup: "ready",
  },
};

describe("PublishBar (T10.9)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("offers Connect GitHub when no account is linked, as a plain link to Updater's route", async () => {
    stubUpdaterRoutes({ "GET /api/portfolio/site": { body: { state: "not_linked" } } });
    renderBar();
    const connect = await screen.findByRole("link", { name: "Connect GitHub" });
    expect(connect).toHaveAttribute("href", "/api/github/app/connect");
    expect(screen.getByText("Not published")).toBeInTheDocument();
  });

  it("explains the setup steps when the repository isn't reachable yet", async () => {
    stubUpdaterRoutes({
      "GET /api/portfolio/site": {
        body: {
          state: "repository_missing",
          login: "octo-sample",
          repository: "octo-sample/octo-sample.github.io",
          installUrl: "https://github.com/apps/updater-test/installations/new",
          createUrl: "https://github.com/new?name=octo-sample.github.io&visibility=public",
        },
      },
    });
    renderBar();
    expect(await screen.findByText("Set up your site on GitHub")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Create a public repository named octo-sample.github.io/ })).toHaveAttribute(
      "href",
      "https://github.com/new?name=octo-sample.github.io&visibility=public",
    );
    expect(screen.getByRole("link", { name: /Install Updater's GitHub App/ })).toHaveAttribute(
      "href",
      "https://github.com/apps/updater-test/installations/new",
    );
    expect(screen.getByRole("button", { name: "Publish" })).toBeDisabled();
  });

  it("publishes after confirmation, waits for GitHub's build, then records the live address", async () => {
    const user = userEvent.setup();
    let builds = 0;
    const fetchMock = stubUpdaterRoutes({
      "GET /api/portfolio/site": { body: READY_SITE },
      "POST /api/portfolio/publish": { body: PUBLISHED },
      "GET /api/portfolio/publish/status": () => {
        builds += 1;
        return { body: { ok: true, value: { state: "built", url: "https://octo-sample.github.io/", builtAt: "2026-10-31T10:01:00Z" } } };
      },
    });
    const { memory } = renderBar();

    await user.click(await enabledPublish());
    const dialog = await screen.findByRole("dialog", { name: "Publish your portfolio?" });
    expect(within(dialog).getByText(/Your email address isn't published/)).toBeInTheDocument();
    expect(within(dialog).getByText(/gh-pages/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Publish" }));

    const publishCall = fetchMock.mock.calls.find(([url, init]) => url === "/api/portfolio/publish" && init?.method === "POST")!;
    const sent = JSON.parse(String(publishCall[1]!.body));
    expect(sent).toEqual({ portfolio: expect.objectContaining({ profile: expect.objectContaining({ name: "Sam Rivera" }) }), confirm: {} });

    await waitFor(() => expect(storedWorkspace(memory).portfolio.publishing.status).toBe("publishing"));
    await waitFor(() => expect(storedWorkspace(memory).portfolio.publishing.status).toBe("published"), { timeout: 4000 });
    expect(builds).toBe(1);
    expect(storedWorkspace(memory).portfolio.publishing).toMatchObject({
      live: { url: "https://octo-sample.github.io/", commitSha: SHA_B, publishedAt: "2026-10-31T10:01:00Z" },
    });
    expect(await screen.findByText("Published")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /https:\/\/octo-sample.github.io\// }).length).toBeGreaterThan(0);
  });

  it("asks before replacing a gh-pages branch Updater didn't create, then sends that confirmation", async () => {
    const user = userEvent.setup();
    const bodies: unknown[] = [];
    stubUpdaterRoutes({
      "GET /api/portfolio/site": { body: READY_SITE },
      "POST /api/portfolio/publish": (init) => {
        const body = JSON.parse(String(init.body));
        bodies.push(body);
        return body.confirm.replaceBranch
          ? { body: PUBLISHED }
          : { status: 409, body: { ok: false, error: { code: "branch_in_use", message: "octo-sample/octo-sample.github.io already has a gh-pages branch that Updater didn't create." } } };
      },
      "GET /api/portfolio/publish/status": { body: { ok: true, value: { state: "building" } } },
    });
    const { memory } = renderBar();
    await user.click(await enabledPublish());
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Publish" }));
    expect(await within(dialog).findByText("Replace the gh-pages branch?")).toBeInTheDocument();
    expect(storedWorkspace(memory).portfolio.publishing.status).toBe("not_published");

    await user.click(within(dialog).getByRole("button", { name: "Replace and publish" }));
    await waitFor(() => expect(storedWorkspace(memory).portfolio.publishing.status).toBe("publishing"));
    expect(bodies[1]).toMatchObject({ confirm: { replaceBranch: true } });
  });

  it("shows a failed build and keeps nothing claimed as published", async () => {
    stubUpdaterRoutes({
      "GET /api/portfolio/site": { body: READY_SITE },
      "GET /api/portfolio/publish/status": { body: { ok: true, value: { state: "errored", message: "Page build failed." } } },
    });
    const pending = must(
      startPublishing(workspaceWithProfile(), { repository: "octo-sample/octo-sample.github.io", commitSha: SHA_B, contentHash: "0000000a" }, T0),
    );
    const { memory } = renderBar(pending);
    expect(await screen.findByText("Publishing", { selector: "p" })).toBeInTheDocument();
    expect(await screen.findByText("The last publish didn't go online", {}, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.getByText("Page build failed.")).toBeInTheDocument();
    expect(storedWorkspace(memory).portfolio.publishing).toMatchObject({ status: "failed" });
    expect(storedWorkspace(memory).portfolio.publishing).not.toHaveProperty("live");
  });
});
