import { manualEntryInputSchema, type ManualEntryInput } from "@/lib/validation/domain";
import { validate } from "@/lib/validation/field-errors";
import { err, ok } from "@/lib/validation/result";
import { createId } from "@/lib/utils/ids";
import { MANUAL_PROVIDER, findSourceForProvider } from "@/lib/providers/registry";
import type { Evidence, Source, SourceItem, Workspace } from "@/types/domain";
import { proposeFromManualItem, toReviewItem } from "@/features/review/proposals";
import { appendActivity, quote } from "@/features/workspace/workspace";
import type { ValidatedResult } from "@/features/profile/profile";

/**
 * Manual entries (FR-SRC-04). The entry becomes a source item under the
 * local "Manual entries" source, the description becomes a user-supplied
 * statement (`user_asserted`, never "verified"), and a review item proposes
 * it for the portfolio.
 */
export function addManualItem(
  ws: Workspace,
  input: ManualEntryInput,
  now: string,
): ValidatedResult<{ workspace: Workspace; itemId: string; reviewItemId: string }> {
  const parsed = validate(manualEntryInputSchema, input);
  if (!parsed.ok) return parsed;
  const value = parsed.value;

  if (value.targetProjectId && !ws.portfolio.projects.some((project) => project.id === value.targetProjectId)) {
    return err("not_found", "That project no longer exists. Choose another one.", "targetProjectId");
  }

  let source = findSourceForProvider(ws, "manual");
  let sources = ws.sources;
  if (!source) {
    const created: Source = {
      id: createId("src"),
      providerId: "manual",
      displayName: MANUAL_PROVIDER.displayName,
      status: "connected",
      isDemo: false,
      createdAt: now,
      updatedAt: now,
    };
    source = created;
    sources = [...sources, created];
  }

  const itemId = createId("item");
  const item: SourceItem = {
    id: itemId,
    sourceId: source.id,
    externalId: itemId,
    kind: value.kind,
    title: value.title,
    ...(value.url ? { url: value.url } : {}),
    ...(value.occurredAt ? { occurredAt: value.occurredAt } : {}),
    discoveredAt: now,
    metadata: value.technologies.length > 0 ? { technologies: value.technologies } : {},
    body: value.description,
    isDemo: false,
    createdAt: now,
    updatedAt: now,
  };

  const evidence: Evidence = {
    id: createId("ev"),
    sourceItemId: item.id,
    kind: "user_statement",
    statement: value.description,
    ...(value.technologies.length > 0
      ? { facts: value.technologies.map((technology) => ({ key: "technology", value: technology })) }
      : {}),
    verification: "user_asserted",
    capturedAt: now,
    isDemo: false,
  };

  const review = toReviewItem(
    proposeFromManualItem(item, evidence, {
      technologies: value.technologies,
      ...(value.targetProjectId ? { targetProjectId: value.targetProjectId } : {}),
    }),
    now,
  );

  const next = appendActivity(
    {
      ...ws,
      sources,
      sourceItems: [...ws.sourceItems, item],
      evidence: [...ws.evidence, evidence],
      reviewItems: [...ws.reviewItems, review],
    },
    { type: "manual_entry_added", summary: `Added the manual entry ${quote(item.title)}`, refId: item.id },
    now,
  );
  return ok({ workspace: next, itemId: item.id, reviewItemId: review.id });
}
