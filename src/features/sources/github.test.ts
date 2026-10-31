import { describe, expect, it } from "vitest";
import { workspaceSchema } from "@/lib/validation/domain";
import { GITHUB_PROVIDER, presentStatus, providerStatus } from "@/lib/providers/registry";
import { approveReviewItem } from "@/features/review/transitions";
import { must, T0, T1, T2, workspaceWithProfile } from "@/test/fixtures";
import type { Workspace } from "@/types/domain";
import type { RawSourceItem } from "./ingestion";
import { addManualItem } from "./manual";
import {
  failureToRecord,
  findGithubSource,
  importGithubRepositories,
  recordGithubFailure,
  removeGithubSource,
  summarizeGithubData,
} from "./github";

function repo(id: number, name: string, metadata: RawSourceItem["metadata"] = {}): RawSourceItem {
  return {
    externalId: `repo:${id}`,
    kind: "repository",
    title: name,
    url: `https://github.com/octo-sample/${name}`,
    occurredAt: "2026-02-03T04:05:06Z",
    metadata: { owner: "octo-sample", ...metadata },
  };
}

const LISTING = [
  repo(1, "tidewatch", { description: "Tide table summaries", language: "Go", topics: ["cli"] }),
  repo(2, "lanterns", { language: "TypeScript" }),
  repo(3, "unchosen", { language: "Rust" }),
];

function imported(ws: Workspace = workspaceWithProfile(), selected = ["repo:1", "repo:2"], now = T1) {
  return must(importGithubRepositories(ws, { login: "octo-sample", repositories: LISTING, selectedExternalIds: selected }, now));
}

describe("GitHub import (T10.1)", () => {
  it("imports only the selected repositories through ingestion, with source-reported evidence and template proposals", () => {
    const { workspace, added, proposals } = imported();
    expect(added).toBe(2);
    expect(workspaceSchema.safeParse(workspace).success).toBe(true);

    const source = findGithubSource(workspace)!;
    expect(source).toMatchObject({ providerId: "github", accountLabel: "octo-sample", status: "connected", isDemo: false });
    expect(source.lastSync).toMatchObject({ attemptedAt: T1, outcome: "succeeded", itemCount: 2 });
    expect(source).not.toHaveProperty("token");

    expect(workspace.sourceItems.map((item) => item.title)).toEqual(["tidewatch", "lanterns"]);
    for (const evidence of workspace.evidence) {
      expect(evidence).toMatchObject({ kind: "fact", verification: "source_reported", isDemo: false });
    }
    const facts = workspace.evidence[0].facts!;
    expect(facts).toEqual(
      expect.arrayContaining([
        { key: "description", value: "Tide table summaries" },
        { key: "language", value: "Go" },
        { key: "topic", value: "cli" },
        { key: "owner", value: "octo-sample" },
      ]),
    );
    // One project per repository plus one skill per new language; nothing from the unselected repository.
    expect(proposals).toBe(4);
    expect(workspace.reviewItems.map((item) => [item.kind, item.proposedText, item.wording])).toEqual([
      ["add_project", "Tide table summaries.", "template"],
      ["add_skill", "Go", "template"],
      ["add_project", "lanterns.", "template"],
      ["add_skill", "TypeScript", "template"],
    ]);
    expect(workspace.activity[0]).toMatchObject({ type: "github_imported" });
    expect(presentStatus(GITHUB_PROVIDER, providerStatus(GITHUB_PROVIDER, workspace)).label).toBe("Public import");
  });

  it("is Not set up until an import succeeds, and refuses an import with nothing chosen", () => {
    const ws = workspaceWithProfile();
    expect(providerStatus(GITHUB_PROVIDER, ws)).toBe("not_connected");
    const refused = importGithubRepositories(ws, { login: "octo-sample", repositories: LISTING, selectedExternalIds: [] }, T1);
    expect(refused).toMatchObject({ ok: false, error: { code: "validation_failed" } });
    // Selecting an id that isn't in the listing imports nothing either.
    const unknown = importGithubRepositories(ws, { login: "octo-sample", repositories: LISTING, selectedExternalIds: ["repo:99"] }, T1);
    expect(unknown.ok).toBe(false);
  });

  it("refreshes imported repositories on a later check without duplicating evidence or proposals (D-024)", () => {
    const first = imported().workspace;
    const renamed = [{ ...LISTING[0], title: "tidewatch-renamed" }, LISTING[1], LISTING[2]];
    const second = must(
      importGithubRepositories(first, { login: "Octo-Sample", repositories: renamed, selectedExternalIds: ["repo:3"] }, T2),
    );
    expect(second.added).toBe(1);
    expect(second.updated).toBe(2);
    const ws = second.workspace;
    expect(ws.sourceItems).toHaveLength(3);
    expect(ws.sourceItems[0]).toMatchObject({ title: "tidewatch-renamed", discoveredAt: T1, updatedAt: T2 });
    expect(ws.reviewItems.filter((item) => item.sourceItemId === ws.sourceItems[0].id)).toHaveLength(2);
    expect(findGithubSource(ws)?.lastSync).toMatchObject({ attemptedAt: T2, outcome: "succeeded", itemCount: 3 });
    expect(ws.sources.filter((source) => source.providerId === "github")).toHaveLength(1);
  });

  it("allows a refresh with no new selection once a source exists", () => {
    const first = imported().workspace;
    const refreshed = must(
      importGithubRepositories(first, { login: "octo-sample", repositories: LISTING, selectedExternalIds: [] }, T2),
    );
    expect(refreshed).toMatchObject({ added: 0, updated: 2 });
  });

  it("refuses to mix accounts in one source", () => {
    const first = imported().workspace;
    const other = importGithubRepositories(first, { login: "someone-else", repositories: LISTING, selectedExternalIds: ["repo:3"] }, T2);
    expect(other).toMatchObject({ ok: false, error: { code: "invalid_transition" } });
  });

  it("rejects invalid repository data from the listing instead of storing it", () => {
    const bad = { ...LISTING[0], externalId: "repo:7", url: "javascript:alert(1)" };
    const outcome = must(
      importGithubRepositories(
        workspaceWithProfile(),
        { login: "octo-sample", repositories: [bad, LISTING[1]], selectedExternalIds: ["repo:7", "repo:2"] },
        T1,
      ),
    );
    expect(outcome.added).toBe(1);
    expect(outcome.rejected).toHaveLength(1);
    expect(outcome.workspace.sourceItems.map((item) => item.externalId)).toEqual(["repo:2"]);
  });
});

describe("recording failed checks (rules.md §7.5.4)", () => {
  it("marks the source as needing attention and keeps imported data", () => {
    const first = imported().workspace;
    const failed = must(recordGithubFailure(first, { outcome: "rate_limited", message: "Limit reached." }, T2));
    const source = findGithubSource(failed)!;
    expect(source.status).toBe("needs_attention");
    expect(source.lastSync).toEqual({ attemptedAt: T2, outcome: "rate_limited", message: "Limit reached." });
    expect(failed.sourceItems).toEqual(first.sourceItems);
    expect(workspaceSchema.safeParse(failed).success).toBe(true);
    expect(presentStatus(GITHUB_PROVIDER, providerStatus(GITHUB_PROVIDER, failed)).label).toBe("Needs attention");

    // The next successful import clears it.
    const recovered = imported(failed, [], T2).workspace;
    expect(findGithubSource(recovered)?.status).toBe("connected");
  });

  it("has nothing to record without a source, and records only GitHub-side failures", () => {
    expect(recordGithubFailure(workspaceWithProfile(), { outcome: "failed", message: "x" }, T1).ok).toBe(false);
    expect(failureToRecord("rate_limited")).toBe("rate_limited");
    expect(failureToRecord("unreachable")).toBe("failed");
    expect(failureToRecord("not_found")).toBe("failed");
    expect(failureToRecord("signed_out")).toBeNull();
    expect(failureToRecord("server_unavailable")).toBeNull();
    expect(failureToRecord("invalid_username")).toBeNull();
  });
});

describe("removing the GitHub source", () => {
  function withApprovedContent() {
    let ws = imported().workspace;
    const project = ws.reviewItems.find((item) => item.kind === "add_project")!;
    const skill = ws.reviewItems.find((item) => item.kind === "add_skill")!;
    ws = must(approveReviewItem(ws, project.id, {}, T2)).workspace;
    ws = must(approveReviewItem(ws, skill.id, {}, T2)).workspace;
    // A manual entry stays untouched by the removal.
    ws = must(
      addManualItem(
        ws,
        { kind: "achievement", title: "Gave a talk", description: "Talked about tides", url: "", occurredAt: "", technologies: "", targetProjectId: "" },
        T2,
      ),
    ).workspace;
    return ws;
  }

  it("summarizes what would be lost", () => {
    expect(summarizeGithubData(workspaceWithProfile())).toBeNull();
    expect(summarizeGithubData(withApprovedContent())).toEqual({
      sourceItems: 2,
      evidence: 2,
      reviewItems: 4,
      claims: 1,
      projects: 1,
      skills: 1,
    });
  });

  it("removes the source, its items, evidence, and proposals, and the approved content when asked", () => {
    const ws = must(removeGithubSource(withApprovedContent(), { keepApprovedContent: false }, T2));
    expect(workspaceSchema.safeParse(ws).success).toBe(true);
    expect(findGithubSource(ws)).toBeUndefined();
    expect(ws.sourceItems.map((item) => item.title)).toEqual(["Gave a talk"]);
    expect(ws.reviewItems).toHaveLength(1);
    expect(ws.portfolio.projects).toEqual([]);
    expect(ws.portfolio.skills).toEqual([]);
    expect(ws.portfolio.claims).toEqual([]);
    expect(ws.activity[0]).toMatchObject({ type: "github_removed" });
    expect(providerStatus(GITHUB_PROVIDER, ws)).toBe("not_connected");
  });

  it("keeps approved content marked “source removed” when asked", () => {
    const ws = must(removeGithubSource(withApprovedContent(), { keepApprovedContent: true }, T2));
    expect(workspaceSchema.safeParse(ws).success).toBe(true);
    expect(ws.portfolio.projects).toEqual([expect.objectContaining({ name: "tidewatch", sourceItemIds: [], sourceRemoved: true })]);
    expect(ws.portfolio.claims).toEqual([expect.objectContaining({ evidenceIds: [], sourceRemoved: true })]);
    expect(ws.portfolio.skills).toEqual([expect.objectContaining({ name: "Go", evidenceIds: [], sourceRemoved: true })]);
    expect(ws.evidence.every((record) => record.verification === "user_asserted")).toBe(true);
  });

  it("can import a different account after removal", () => {
    const removed = must(removeGithubSource(imported().workspace, { keepApprovedContent: false }, T2));
    const other = importGithubRepositories(removed, { login: "someone-else", repositories: LISTING, selectedExternalIds: ["repo:1"] }, T2);
    expect(other.ok).toBe(true);
  });

  it("refuses when there is no GitHub source", () => {
    expect(removeGithubSource(workspaceWithProfile(), { keepApprovedContent: false }, T0).ok).toBe(false);
  });
});
