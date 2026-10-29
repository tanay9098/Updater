import { createId } from "@/lib/utils/ids";
import type { Evidence, ReviewItem, SourceItem } from "@/types/domain";

/**
 * Deterministic proposals over evidence (D-009, architecture.md §7 step 4).
 *
 * Templates only reuse values that are present in the evidence: titles,
 * descriptions, repository names, dates. They never add numbers, outcomes,
 * responsibilities, or technologies (rules.md §7.1.11). For manual entries,
 * the user's own description is the proposal (`wording: 'user'`).
 */

export type ProposalDraft = Omit<ReviewItem, "id" | "status" | "createdAt" | "updatedAt">;

function factValue(evidence: ReadonlyArray<Evidence>, key: string): string | undefined {
  for (const record of evidence) {
    const fact = record.facts?.find((candidate) => candidate.key === key);
    if (fact && fact.value.trim() !== "") return fact.value;
  }
  return undefined;
}

function factValues(evidence: ReadonlyArray<Evidence>, key: string): string[] {
  const values: string[] = [];
  for (const record of evidence) {
    for (const fact of record.facts ?? []) {
      if (fact.key === key && fact.value.trim() !== "") values.push(fact.value);
    }
  }
  return values;
}

function ensureSentence(text: string): string {
  const trimmed = text.trim();
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function linksFor(item: SourceItem) {
  return item.url ? [{ id: createId("link"), label: linkLabel(item), url: item.url }] : [];
}

function linkLabel(item: SourceItem): string {
  switch (item.kind) {
    case "repository":
      return "Repository";
    case "pull_request":
      return "Pull request";
    case "article":
      return "Article";
    default:
      return "Link";
  }
}

/** Template proposals for items retrieved from a provider (demo fixtures in the MVP). */
export function proposeFromSourceItem(item: SourceItem, evidence: ReadonlyArray<Evidence>): ProposalDraft[] {
  const evidenceIds = evidence.map((record) => record.id);
  if (evidenceIds.length === 0) return [];
  const base = { evidenceIds, sourceItemId: item.id, isDemo: item.isDemo, wording: "template" as const };

  switch (item.kind) {
    case "repository": {
      const description = factValue(evidence, "description");
      const technologies = [...factValues(evidence, "language"), ...factValues(evidence, "topic")];
      const uniqueTech = Array.from(new Map(technologies.map((tech) => [tech.toLowerCase(), tech])).values());
      return [
        {
          ...base,
          kind: "add_project",
          proposedText: ensureSentence(description ?? item.title),
          proposedProject: { name: item.title, technologies: uniqueTech, links: linksFor(item) },
          rationale: description
            ? "Created from the repository's name, description, language, and topics."
            : "Created from the repository's name. It has no description.",
        },
      ];
    }
    case "pull_request": {
      const repository = factValue(evidence, "repository");
      const state = factValue(evidence, "state");
      const verb = state === "merged" ? "Contributed a merged pull request" : "Opened a pull request";
      return [
        {
          ...base,
          kind: "add_claim",
          proposedText: ensureSentence(`${verb}${repository ? ` to ${repository}` : ""}: “${item.title}”`),
          rationale: "Created from the pull request's title, repository, and state.",
        },
      ];
    }
    case "article": {
      const publication = factValue(evidence, "publication");
      return [
        {
          ...base,
          kind: "add_claim",
          proposedText: ensureSentence(`Wrote “${item.title}”${publication ? `, published on ${publication}` : ""}`),
          rationale: "Created from the article's title and publication.",
        },
      ];
    }
    default:
      return [];
  }
}

/** A skill proposal from a source-reported language (one per distinct name). */
export function proposeSkill(name: string, item: SourceItem, evidence: Evidence): ProposalDraft {
  return {
    kind: "add_skill",
    proposedText: name,
    wording: "template",
    rationale: `Created from the language reported for “${item.title}”.`,
    evidenceIds: [evidence.id],
    sourceItemId: item.id,
    isDemo: item.isDemo,
  };
}

/** Manual entries: the user's own words become the proposal (architecture.md §7 step 4). */
export function proposeFromManualItem(
  item: SourceItem,
  evidence: Evidence,
  options: { technologies: string[]; targetProjectId?: string },
): ProposalDraft {
  const base = {
    evidenceIds: [evidence.id],
    sourceItemId: item.id,
    isDemo: false,
    wording: "user" as const,
    proposedText: ensureSentence(evidence.statement),
  };
  if (item.kind === "project") {
    return {
      ...base,
      kind: "add_project",
      proposedProject: { name: item.title, technologies: options.technologies, links: linksFor(item) },
      rationale: "Your own description of a project you added under Manual entries.",
    };
  }
  return {
    ...base,
    kind: "add_claim",
    ...(options.targetProjectId ? { targetProjectId: options.targetProjectId } : {}),
    rationale: `Your own description of the ${item.kind} you added under Manual entries.`,
  };
}

export function toReviewItem(draft: ProposalDraft, now: string): ReviewItem {
  return { ...draft, id: createId("rev"), status: "needs_review", createdAt: now, updatedAt: now };
}
