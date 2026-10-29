import type { ReviewKind, SourceItemKind } from "@/types/domain";

export const KIND_LABELS: Record<ReviewKind, string> = {
  add_project: "New project",
  add_claim: "New achievement",
  add_skill: "New skill",
};

export const ITEM_KIND_LABELS: Record<SourceItemKind, string> = {
  repository: "Repository",
  pull_request: "Pull request",
  article: "Article",
  contribution: "Contribution",
  project: "Project",
  achievement: "Achievement",
};
