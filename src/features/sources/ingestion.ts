import { z } from "zod";
import { externalUrlSchema, optionalText, requiredText } from "@/lib/validation/schemas";
import { sourceItemKindSchema } from "@/lib/validation/domain";
import { toFieldErrors } from "@/lib/validation/field-errors";
import { err, ok, type Result } from "@/lib/validation/result";
import { createId } from "@/lib/utils/ids";
import type { Evidence, ReviewItem, SourceItem, Workspace } from "@/types/domain";
import { proposeFromSourceItem, proposeSkill, toReviewItem } from "@/features/review/proposals";
import { findSource } from "@/features/workspace/workspace";

/**
 * Ingestion pipeline (architecture.md §7 steps 1–4):
 * raw provider item → validate and normalize → SourceItem → Evidence → proposals.
 *
 * Raw items are untrusted. An item that fails validation is rejected with a
 * reason and nothing from it is stored (FR-SYNC-01). Items already present
 * under the same `(sourceId, externalId)` update the stored snapshot instead
 * of creating a duplicate (FR-SYNC-04); their evidence and proposals are left
 * as they are, because claims may already point at that evidence.
 */

const metadataValue = z.union([
  z.string().trim().max(500),
  z.number().finite(),
  z.boolean(),
  z.array(z.string().trim().max(100)).max(50),
]);

const rawFactSchema = z.object({ key: requiredText("Fact key", 60), value: z.string().trim().max(500) });

export const rawSourceItemSchema = z.object({
  externalId: requiredText("External ID", 200),
  kind: sourceItemKindSchema,
  title: requiredText("Title", 200),
  url: externalUrlSchema.optional(),
  occurredAt: z.union([z.iso.date(), z.iso.datetime()]).optional(),
  metadata: z.record(z.string().max(60), metadataValue).default({}),
  body: optionalText("Body", 5000).optional(),
  /** Quoted passages from the item body, each with the facts it states. */
  excerpts: z
    .array(z.object({ statement: requiredText("Excerpt", 2000), facts: z.array(rawFactSchema).max(30).default([]) }))
    .max(10)
    .default([]),
});
export type RawSourceItem = z.input<typeof rawSourceItemSchema>;

export type Rejection = { index: number; externalId?: string; reason: string };

export type IngestionOutcome = {
  workspace: Workspace;
  added: SourceItem[];
  updated: SourceItem[];
  rejected: Rejection[];
  proposals: ReviewItem[];
};

/** Metadata keys that become structured facts, with the readable statement label. */
const FACT_KEYS: Record<string, string> = {
  description: "description",
  language: "language",
  topics: "topic",
  repository: "repository",
  state: "state",
  publication: "publication",
};

function metadataFacts(metadata: SourceItem["metadata"]): { key: string; value: string }[] {
  const facts: { key: string; value: string }[] = [];
  for (const [key, value] of Object.entries(metadata)) {
    const factKey = FACT_KEYS[key] ?? key;
    if (Array.isArray(value)) {
      for (const entry of value) facts.push({ key: factKey, value: entry });
    } else {
      facts.push({ key: factKey, value: String(value) });
    }
  }
  return facts;
}

function metadataStatement(item: SourceItem): string {
  switch (item.kind) {
    case "repository":
      return `Repository details for “${item.title}” as reported by the source.`;
    case "pull_request":
      return `Pull request details for “${item.title}” as reported by the source.`;
    case "article":
      return `Article details for “${item.title}” as reported by the source.`;
    default:
      return `Details for “${item.title}” as reported by the source.`;
  }
}

/**
 * Derives evidence from a normalized item: one `fact` record from its
 * metadata and one `excerpt` record per quoted passage. When an excerpt
 * states a different value for a fact the metadata also reports, both
 * records are marked `conflicting` and point at each other (rules.md §7.1.5).
 */
export function deriveEvidence(
  item: SourceItem,
  excerpts: ReadonlyArray<{ statement: string; facts: { key: string; value: string }[] }>,
  now: string,
): Evidence[] {
  const records: Evidence[] = [];
  const facts = metadataFacts(item.metadata);
  if (facts.length > 0 || excerpts.length === 0) {
    records.push({
      id: createId("ev"),
      sourceItemId: item.id,
      kind: "fact",
      statement: metadataStatement(item),
      facts,
      verification: "source_reported",
      capturedAt: now,
      isDemo: item.isDemo,
    });
  }
  for (const excerpt of excerpts) {
    records.push({
      id: createId("ev"),
      sourceItemId: item.id,
      kind: "excerpt",
      statement: excerpt.statement,
      facts: excerpt.facts,
      verification: "source_reported",
      capturedAt: now,
      isDemo: item.isDemo,
    });
  }
  return markConflicts(records);
}

function markConflicts(records: Evidence[]): Evidence[] {
  const conflicts = new Map<string, Set<string>>();
  for (let i = 0; i < records.length; i += 1) {
    for (let j = i + 1; j < records.length; j += 1) {
      const a = records[i];
      const b = records[j];
      const disagree = (a.facts ?? []).some((factA) =>
        (b.facts ?? []).some(
          (factB) =>
            factA.key === factB.key &&
            factA.key !== "topic" &&
            factA.value.trim().toLowerCase() !== factB.value.trim().toLowerCase() &&
            // A key reported once per record is single-valued, so different values disagree.
            (a.facts ?? []).filter((fact) => fact.key === factA.key).length === 1 &&
            (b.facts ?? []).filter((fact) => fact.key === factB.key).length === 1,
        ),
      );
      if (!disagree) continue;
      conflicts.set(a.id, (conflicts.get(a.id) ?? new Set()).add(b.id));
      conflicts.set(b.id, (conflicts.get(b.id) ?? new Set()).add(a.id));
    }
  }
  return records.map((record) => {
    const others = conflicts.get(record.id);
    return others ? { ...record, verification: "conflicting", conflictsWith: Array.from(others) } : record;
  });
}

export function ingestItems(
  ws: Workspace,
  sourceId: string,
  rawItems: ReadonlyArray<unknown>,
  now: string,
): Result<IngestionOutcome> {
  const source = findSource(ws, sourceId);
  if (!source) return err("not_found", "That source no longer exists.");

  let sourceItems = [...ws.sourceItems];
  const evidence = [...ws.evidence];
  const reviewItems = [...ws.reviewItems];
  const added: SourceItem[] = [];
  const updated: SourceItem[] = [];
  const rejected: Rejection[] = [];
  const proposals: ReviewItem[] = [];

  const knownSkillNames = new Set([
    ...ws.portfolio.skills.map((skill) => skill.name.toLowerCase()),
    ...ws.reviewItems
      .filter((item) => item.kind === "add_skill" && item.status !== "dismissed")
      .map((item) => item.proposedText.toLowerCase()),
  ]);

  rawItems.forEach((raw, index) => {
    const parsed = rawSourceItemSchema.safeParse(raw);
    if (!parsed.success) {
      const errors = toFieldErrors(parsed.error);
      const [field, message] = Object.entries(errors)[0] ?? ["", "Invalid item."];
      const externalId =
        typeof raw === "object" && raw !== null && typeof (raw as { externalId?: unknown }).externalId === "string"
          ? (raw as { externalId: string }).externalId
          : undefined;
      rejected.push({ index, ...(externalId ? { externalId } : {}), reason: field ? `${field}: ${message}` : message });
      return;
    }
    const value = parsed.data;
    const existing = sourceItems.find((item) => item.sourceId === sourceId && item.externalId === value.externalId);
    const snapshot = {
      kind: value.kind,
      title: value.title,
      metadata: value.metadata,
      ...(value.url ? { url: value.url } : {}),
      ...(value.occurredAt ? { occurredAt: value.occurredAt } : {}),
      ...(value.body ? { body: value.body } : {}),
    };

    if (existing) {
      const refreshed: SourceItem = {
        id: existing.id,
        sourceId,
        externalId: existing.externalId,
        discoveredAt: existing.discoveredAt,
        isDemo: existing.isDemo,
        createdAt: existing.createdAt,
        updatedAt: now,
        ...snapshot,
      };
      sourceItems = sourceItems.map((item) => (item.id === existing.id ? refreshed : item));
      updated.push(refreshed);
      return;
    }

    const item: SourceItem = {
      id: createId("item"),
      sourceId,
      externalId: value.externalId,
      discoveredAt: now,
      isDemo: source.isDemo,
      createdAt: now,
      updatedAt: now,
      ...snapshot,
    };
    const itemEvidence = deriveEvidence(item, value.excerpts, now);
    sourceItems.push(item);
    evidence.push(...itemEvidence);
    added.push(item);

    for (const draft of proposeFromSourceItem(item, itemEvidence)) {
      const review = toReviewItem(draft, now);
      reviewItems.push(review);
      proposals.push(review);
    }

    const factRecord = itemEvidence.find((record) => record.kind === "fact");
    for (const fact of factRecord?.facts ?? []) {
      if (fact.key !== "language" || !factRecord) continue;
      const key = fact.value.toLowerCase();
      if (knownSkillNames.has(key)) continue;
      knownSkillNames.add(key);
      const review = toReviewItem(proposeSkill(fact.value, item, factRecord), now);
      reviewItems.push(review);
      proposals.push(review);
    }
  });

  return ok({
    workspace: { ...ws, sourceItems, evidence, reviewItems },
    added,
    updated,
    rejected,
    proposals,
  });
}
