import type { Workspace } from "@/types/domain";
import { projectClaims, projectSummary, standaloneClaims } from "@/features/portfolio/portfolio";

/**
 * Role-based selection suggestions (FR-RES-05, architecture.md §12).
 *
 * Deterministic keyword overlap between the target role (plus optional
 * keywords) and each item's name, technologies, and text. It only returns
 * IDs to pre-select. It never writes or alters text, and the user can change
 * every selection.
 */

const STOP_WORDS = new Set([
  "a", "an", "and", "at", "for", "in", "of", "on", "or", "the", "to", "with",
  "engineer", "engineering", "developer", "development", "dev", "senior", "junior", "lead", "staff",
  "principal", "intern", "role", "position", "software", "team",
]);

/**
 * Words a role title commonly implies. Only used to widen matching against
 * the user's own approved content; never shown as text.
 */
const ROLE_HINTS: Record<string, string[]> = {
  frontend: ["react", "css", "html", "javascript", "typescript", "accessibility", "ui", "forms", "pwa", "web"],
  "front-end": ["react", "css", "html", "javascript", "typescript", "accessibility", "ui", "forms", "pwa", "web"],
  backend: ["api", "server", "database", "sql", "postgres", "cache", "go", "node", "python", "java", "rust", "cli"],
  "back-end": ["api", "server", "database", "sql", "postgres", "cache", "go", "node", "python", "java", "rust", "cli"],
  fullstack: ["react", "typescript", "javascript", "api", "server", "database", "web"],
  "full-stack": ["react", "typescript", "javascript", "api", "server", "database", "web"],
  mobile: ["android", "ios", "kotlin", "swift", "react-native", "flutter", "offline-first"],
  devrel: ["article", "writing", "talk", "docs", "documentation", "blog", "community"],
  "developer relations": ["article", "writing", "talk", "docs", "documentation", "blog", "community"],
  data: ["python", "sql", "csv", "pandas", "analytics", "etl"],
  platform: ["infrastructure", "cache", "kubernetes", "terraform", "ci", "cli", "go"],
  infrastructure: ["kubernetes", "terraform", "ci", "cache", "cli", "go"],
};

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9+#.-]+/)
    .map((token) => token.replace(/^[.-]+|[.-]+$/g, ""))
    .filter((token) => token.length >= 2 && !STOP_WORDS.has(token));
}

export function roleTerms(targetRole: string, keywords = ""): Set<string> {
  const terms = new Set([...tokenize(targetRole), ...tokenize(keywords)]);
  const lowerRole = targetRole.toLowerCase();
  for (const [hint, words] of Object.entries(ROLE_HINTS)) {
    if (lowerRole.includes(hint) || terms.has(hint)) for (const word of words) terms.add(word);
  }
  return terms;
}

function overlap(terms: Set<string>, text: string): number {
  const tokens = new Set(tokenize(text));
  let score = 0;
  for (const token of tokens) if (terms.has(token)) score += 1;
  return score;
}

export type SelectionSuggestion = { projectIds: string[]; claimIds: string[]; skillIds: string[]; terms: string[] };

export function suggestSelections(ws: Workspace, targetRole: string, keywords = ""): SelectionSuggestion {
  const terms = roleTerms(targetRole, keywords);
  if (terms.size === 0) return { projectIds: [], claimIds: [], skillIds: [], terms: [] };

  const projectIds: string[] = [];
  const claimIds: string[] = [];
  for (const project of ws.portfolio.projects) {
    const text = [project.name, project.technologies.join(" "), projectSummary(ws, project).text].join(" ");
    const claims = projectClaims(ws, project);
    const matchingClaims = claims.filter((claim) => overlap(terms, claim.text) > 0);
    if (overlap(terms, text) > 0 || matchingClaims.length > 0) {
      projectIds.push(project.id);
      // Within a matching project, its achievements are relevant context too.
      for (const claim of claims) claimIds.push(claim.id);
    }
  }
  for (const claim of standaloneClaims(ws)) {
    if (overlap(terms, claim.text) > 0) claimIds.push(claim.id);
  }
  const skillIds = ws.portfolio.skills
    .filter((skill) => skill.visible && overlap(terms, skill.name) > 0)
    .map((skill) => skill.id);

  return { projectIds, claimIds, skillIds, terms: Array.from(terms) };
}
