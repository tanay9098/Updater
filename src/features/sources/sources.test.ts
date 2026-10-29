import { describe, expect, it } from "vitest";
import { DEMO_ITEMS } from "@/lib/data/demo-fixtures";
import { workspaceSchema } from "@/lib/validation/domain";
import { PROVIDERS, providerStatus } from "@/lib/providers/registry";
import { createEmptyWorkspace, hasDemoData } from "@/features/workspace/workspace";
import { approveReviewItem } from "@/features/review/transitions";
import { createResume, updateResume } from "@/features/resumes/drafts";
import { demoWorkspace, manualWorkspace, MANUAL_PROJECT, must, T0, T1, T2, workspaceWithProfile } from "@/test/fixtures";
import { addManualItem } from "./manual";
import { ingestItems } from "./ingestion";
import { loadDemoWorkspace, removeDemoData, summarizeDemoData } from "./demo";

function digits(text: string): string[] {
  return text.match(/\d+/g) ?? [];
}

describe("provider registry (T4.1)", () => {
  it("never reports a planned provider as connected, and planned providers expose no operations", () => {
    const ws = demoWorkspace();
    for (const provider of PROVIDERS.filter((candidate) => candidate.availability === "planned")) {
      expect(providerStatus(provider, ws)).toBe("planned");
      expect(Object.keys(provider)).not.toContain("connect");
      expect(Object.keys(provider)).not.toContain("sync");
    }
  });

  it("shows the demo provider as demo only while fixtures are loaded", () => {
    const demo = PROVIDERS.find((provider) => provider.id === "demo")!;
    expect(providerStatus(demo, createEmptyWorkspace())).toBe("not_connected");
    expect(providerStatus(demo, demoWorkspace())).toBe("demo");
  });

  it("rejects a stored source whose provider can't produce its status", () => {
    const ws = demoWorkspace();
    const tampered = { ...ws, sources: ws.sources.map((source) => ({ ...source, providerId: "github", status: "connected" })) };
    expect(workspaceSchema.safeParse(tampered).success).toBe(false);
  });
});

describe("manual entries (FR-SRC-04)", () => {
  it("creates a local source, a source item, user-asserted evidence, and a user-worded proposal", () => {
    const { ws, itemId, reviewItemId } = manualWorkspace();
    expect(ws.sources).toEqual([expect.objectContaining({ providerId: "manual", status: "connected", isDemo: false })]);
    const item = ws.sourceItems.find((candidate) => candidate.id === itemId)!;
    expect(item).toMatchObject({ kind: "project", title: "Garden planner", url: "https://example.com/garden", occurredAt: "2026-04-01" });
    expect(ws.evidence).toEqual([
      expect.objectContaining({
        sourceItemId: itemId,
        kind: "user_statement",
        verification: "user_asserted",
        statement: MANUAL_PROJECT.description,
      }),
    ]);
    const review = ws.reviewItems.find((candidate) => candidate.id === reviewItemId)!;
    expect(review).toMatchObject({ kind: "add_project", wording: "user", status: "needs_review" });
    expect(review.proposedText).toBe(`${MANUAL_PROJECT.description}.`);
    expect(workspaceSchema.safeParse(ws).success).toBe(true);
  });

  it("reuses the manual source for later entries", () => {
    const { ws } = manualWorkspace();
    const next = must(addManualItem(ws, { ...MANUAL_PROJECT, title: "Second" }, T1)).workspace;
    expect(next.sources).toHaveLength(1);
    expect(next.sourceItems).toHaveLength(2);
  });

  it("validates input and stores nothing on failure", () => {
    const ws = workspaceWithProfile();
    const result = addManualItem(ws, { ...MANUAL_PROJECT, title: " ", url: "javascript:alert(1)", occurredAt: "yesterday" }, T0);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fieldErrors).toMatchObject({
        title: "Title is required.",
        url: expect.stringContaining("http"),
        occurredAt: "Enter a date as YYYY-MM-DD.",
      });
    }
  });

  it("refuses a target project that doesn't exist", () => {
    const result = addManualItem(workspaceWithProfile(), { ...MANUAL_PROJECT, kind: "achievement", targetProjectId: "proj_gone" }, T0);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatchObject({ code: "not_found", field: "targetProjectId" });
  });
});

describe("ingestion (FR-SYNC-01, FR-SYNC-04)", () => {
  it("rejects invalid items with a reason and stores none of their data", () => {
    const ws = demoWorkspace();
    const source = ws.sources[0];
    const outcome = must(
      ingestItems(ws, source.id, [{ externalId: "bad", kind: "repository", title: "x", url: "javascript:alert(1)" }, "nonsense"], T1),
    );
    expect(outcome.added).toHaveLength(0);
    expect(outcome.rejected).toEqual([
      { index: 0, externalId: "bad", reason: expect.stringContaining("url") },
      { index: 1, reason: expect.any(String) },
    ]);
    expect(outcome.workspace.sourceItems).toHaveLength(ws.sourceItems.length);
  });

  it("de-duplicates by (sourceId, externalId) and updates the snapshot instead", () => {
    const ws = demoWorkspace();
    const source = ws.sources[0];
    const outcome = must(ingestItems(ws, source.id, [{ ...DEMO_ITEMS[1], title: "tidepool-renamed" }], T2));
    expect(outcome.added).toHaveLength(0);
    expect(outcome.updated).toHaveLength(1);
    expect(outcome.workspace.sourceItems).toHaveLength(ws.sourceItems.length);
    expect(outcome.workspace.evidence).toHaveLength(ws.evidence.length);
    expect(outcome.workspace.reviewItems).toHaveLength(ws.reviewItems.length);
    const updated = outcome.workspace.sourceItems.find((item) => item.externalId === DEMO_ITEMS[1].externalId)!;
    expect(updated.title).toBe("tidepool-renamed");
    expect(updated.discoveredAt).toBe(T0);
  });

  it("refuses an unknown source", () => {
    expect(ingestItems(createEmptyWorkspace(), "src_missing", [], T0).ok).toBe(false);
  });
});

describe("demo workspace (D-010)", () => {
  it("loads fictional, labeled fixtures with example.com links only", () => {
    const ws = demoWorkspace();
    expect(workspaceSchema.safeParse(ws).success).toBe(true);
    expect(ws.sources).toEqual([expect.objectContaining({ providerId: "demo", status: "demo", isDemo: true })]);
    expect(ws.sourceItems.length).toBe(DEMO_ITEMS.length);
    for (const item of ws.sourceItems) {
      expect(item.isDemo).toBe(true);
      expect(new URL(item.url!).hostname).toBe("example.com");
    }
    expect(ws.evidence.every((evidence) => evidence.isDemo)).toBe(true);
    expect(ws.reviewItems.every((item) => item.isDemo && item.status === "needs_review")).toBe(true);
    expect(hasDemoData(ws)).toBe(true);
  });

  it("never invents numbers: every number in a template proposal appears in its evidence (rules.md §7.1.11)", () => {
    const ws = demoWorkspace();
    for (const item of ws.reviewItems.filter((review) => review.wording === "template")) {
      const evidenceText = ws.evidence
        .filter((evidence) => item.evidenceIds.includes(evidence.id))
        .map((evidence) => [evidence.statement, ...(evidence.facts ?? []).map((fact) => fact.value)].join(" "))
        .join(" ");
      const sourceItem = ws.sourceItems.find((candidate) => candidate.id === item.sourceItemId)!;
      for (const number of digits(item.proposedText)) {
        expect(`${evidenceText} ${sourceItem.title}`).toContain(number);
      }
    }
  });

  it("flags the deliberate license conflict on both records", () => {
    const conflicting = demoWorkspace().evidence.filter((evidence) => evidence.verification === "conflicting");
    expect(conflicting).toHaveLength(2);
    expect(conflicting[0].conflictsWith).toEqual([conflicting[1].id]);
    expect(conflicting[1].conflictsWith).toEqual([conflicting[0].id]);
  });

  it("can't be loaded twice", () => {
    const result = loadDemoWorkspace(demoWorkspace(), T1);
    expect(result.ok).toBe(false);
  });

  it("removal deletes demo records, keeps the user's own, and prunes resumes (FR-SRC-05)", () => {
    let ws = must(addManualItem(demoWorkspace(), MANUAL_PROJECT, T1)).workspace;
    const pr = ws.reviewItems.find((item) => item.isDemo && item.kind === "add_claim")!;
    const approved = must(approveReviewItem(ws, pr.id, {}, T1));
    ws = approved.workspace;
    const created = must(createResume(ws, { targetRole: "Backend Engineer", name: "" }, T1));
    ws = must(
      updateResume(
        created.workspace,
        created.resumeId,
        { name: "Backend", targetRole: "Backend Engineer", summary: "", projectIds: [], claimIds: [approved.claimId!], skillIds: [], overrides: {}, includeContact: true },
        T1,
      ),
    );

    expect(summarizeDemoData(ws).claims).toBe(1);
    const removed = must(removeDemoData(ws, { keepApprovedContent: false }, T2));
    expect(removed.sources.map((source) => source.providerId)).toEqual(["manual"]);
    expect(removed.sourceItems.every((item) => !item.isDemo)).toBe(true);
    expect(removed.sourceItems).toHaveLength(1);
    expect(removed.evidence.every((evidence) => !evidence.isDemo)).toBe(true);
    expect(removed.reviewItems.every((item) => !item.isDemo)).toBe(true);
    expect(removed.portfolio.claims).toHaveLength(0);
    expect(removed.resumes[0].claimIds).toEqual([]);
    expect(hasDemoData(removed)).toBe(false);
    expect(workspaceSchema.safeParse(removed).success).toBe(true);
  });

  it("removal can keep approved demo content, still labeled and marked source removed", () => {
    const ws = demoWorkspace();
    const pr = ws.reviewItems.find((item) => item.kind === "add_claim")!;
    const approved = must(approveReviewItem(ws, pr.id, {}, T1)).workspace;
    const removed = must(removeDemoData(approved, { keepApprovedContent: true }, T2));
    expect(removed.portfolio.claims).toEqual([
      expect.objectContaining({ isDemo: true, sourceRemoved: true, evidenceIds: [] }),
    ]);
    expect(removed.evidence).toHaveLength(0);
    expect(hasDemoData(removed)).toBe(true);
    expect(workspaceSchema.safeParse(removed).success).toBe(true);
  });
});
