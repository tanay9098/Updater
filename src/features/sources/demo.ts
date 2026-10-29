import { DEMO_ITEMS, DEMO_SOURCE_NAME } from "@/lib/data/demo-fixtures";
import { err, ok, type Result } from "@/lib/validation/result";
import { createId } from "@/lib/utils/ids";
import { findSourceForProvider } from "@/lib/providers/registry";
import type { Source, Workspace } from "@/types/domain";
import { appendActivity } from "@/features/workspace/workspace";
import { pruneReferences } from "@/features/workspace/integrity";
import { ingestItems } from "./ingestion";

/**
 * Loads the fictional demo workspace through the same ingestion pipeline a
 * real provider would use. The source's status is `demo`; it is never
 * described as a connection (architecture.md §7.3).
 */
export function loadDemoWorkspace(ws: Workspace, now: string): Result<Workspace> {
  if (findSourceForProvider(ws, "demo")) {
    return err("invalid_transition", "Demo data is already loaded.");
  }
  const source: Source = {
    id: createId("src"),
    providerId: "demo",
    displayName: DEMO_SOURCE_NAME,
    status: "demo",
    isDemo: true,
    createdAt: now,
    updatedAt: now,
  };
  const ingested = ingestItems({ ...ws, sources: [...ws.sources, source] }, source.id, DEMO_ITEMS, now);
  if (!ingested.ok) return ingested;
  if (ingested.value.rejected.length > 0) {
    // Fixtures are code-owned; a rejection is a bug, not user error.
    return err("unexpected", `Demo data failed validation: ${ingested.value.rejected[0].reason}`);
  }
  return ok(
    appendActivity(
      ingested.value.workspace,
      {
        type: "demo_loaded",
        summary: `Loaded demo data: ${ingested.value.added.length} fictional items and ${ingested.value.proposals.length} proposals`,
      },
      now,
    ),
  );
}

export type DemoRemovalSummary = {
  sourceItems: number;
  evidence: number;
  reviewItems: number;
  claims: number;
  projects: number;
  skills: number;
};

/** What removing the demo data would delete, for the confirmation dialog (rules.md §7.2.5). */
export function summarizeDemoData(ws: Workspace): DemoRemovalSummary {
  return {
    sourceItems: ws.sourceItems.filter((item) => item.isDemo).length,
    evidence: ws.evidence.filter((evidence) => evidence.isDemo).length,
    reviewItems: ws.reviewItems.filter((item) => item.isDemo).length,
    claims: ws.portfolio.claims.filter((claim) => claim.isDemo).length,
    projects: ws.portfolio.projects.filter((project) => project.isDemo).length,
    skills: ws.portfolio.skills.filter((skill) => skill.isDemo).length,
  };
}

/**
 * Removes the demo source, its items, evidence, and review items (FR-SRC-05).
 * Approved demo content is removed too, unless the user chooses to keep it;
 * kept content stays labeled Demo and is marked "source removed".
 */
export function removeDemoData(
  ws: Workspace,
  options: { keepApprovedContent: boolean },
  now: string,
): Result<Workspace> {
  const summary = summarizeDemoData(ws);
  const hasAny = Object.values(summary).some((count) => count > 0) || ws.sources.some((source) => source.isDemo);
  if (!hasAny) return err("not_found", "There is no demo data to remove.");

  const keep = options.keepApprovedContent;
  const portfolio = {
    ...ws.portfolio,
    claims: keep
      ? ws.portfolio.claims.map((claim) => (claim.isDemo ? { ...claim, evidenceIds: [], sourceRemoved: true } : claim))
      : ws.portfolio.claims.filter((claim) => !claim.isDemo),
    projects: keep
      ? ws.portfolio.projects.map((project) =>
          project.isDemo ? { ...project, sourceItemIds: [], sourceRemoved: true } : project,
        )
      : ws.portfolio.projects.filter((project) => !project.isDemo),
    skills: keep
      ? ws.portfolio.skills.map((skill) => (skill.isDemo ? { ...skill, evidenceIds: [], sourceRemoved: true } : skill))
      : ws.portfolio.skills.filter((skill) => !skill.isDemo),
  };
  const demoItemIds = new Set(ws.sourceItems.filter((item) => item.isDemo).map((item) => item.id));
  portfolio.projects = portfolio.projects.map((project) =>
    project.sourceItemIds.some((id) => demoItemIds.has(id))
      ? { ...project, sourceItemIds: project.sourceItemIds.filter((id) => !demoItemIds.has(id)) }
      : project,
  );

  const stripped: Workspace = {
    ...ws,
    sources: ws.sources.filter((source) => !source.isDemo),
    sourceItems: ws.sourceItems.filter((item) => !item.isDemo),
    evidence: ws.evidence.filter((evidence) => !evidence.isDemo),
    reviewItems: ws.reviewItems.filter((item) => !item.isDemo),
    portfolio,
  };
  const { workspace } = pruneReferences(stripped);
  return ok(
    appendActivity(
      workspace,
      {
        type: "demo_removed",
        summary: keep ? "Removed demo data and kept approved demo content" : "Removed demo data",
      },
      now,
    ),
  );
}
