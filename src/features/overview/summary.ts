import type { ActivityEntry, Evidence, ReviewItem, Workspace } from "@/types/domain";
import { profileChecklist } from "@/features/profile/profile";
import { isPending } from "@/features/workspace/workspace";

/**
 * Overview content derived only from workspace state (FR-DASH-01). No
 * invented metrics: every number is a count of stored records.
 */

export type NextAction =
  | { id: "onboarding"; title: string; description: string; href: "/onboarding"; label: string }
  | { id: "profile"; title: string; description: string; href: "/portfolio"; label: string }
  | { id: "evidence"; title: string; description: string; href: "/sources"; label: string }
  | { id: "review"; title: string; description: string; href: "/review"; label: string }
  | { id: "preview"; title: string; description: string; href: "/portfolio"; label: string }
  | { id: "resume"; title: string; description: string; href: "/resumes"; label: string }
  | { id: "maintain"; title: string; description: string; href: "/sources"; label: string };

/** One recommendation, chosen by rules in priority order (design.md §8). */
export function nextAction(ws: Workspace): NextAction {
  if (!ws.profile && !ws.onboarding.completedAt) {
    return {
      id: "onboarding",
      title: "Set up Updater",
      description: "Add your name and choose how to start: your own entries, or fictional demo data.",
      href: "/onboarding",
      label: "Get started",
    };
  }
  if (!ws.profile) {
    return {
      id: "profile",
      title: "Add your profile",
      description: "Your name is needed for the portfolio and resumes.",
      href: "/portfolio",
      label: "Edit profile",
    };
  }
  if (ws.sourceItems.length === 0) {
    return {
      id: "evidence",
      title: "Add evidence of your work",
      description: "Record a project, article, contribution, or achievement. Updater turns it into a proposal you review.",
      href: "/sources",
      label: "Go to Sources",
    };
  }
  const pending = ws.reviewItems.filter(isPending).length;
  if (pending > 0) {
    return {
      id: "review",
      title: `Review ${pending} pending ${pending === 1 ? "proposal" : "proposals"}`,
      description: "Nothing reaches your portfolio until you approve it.",
      href: "/review",
      label: "Open Review Queue",
    };
  }
  const hasPortfolioContent = ws.portfolio.projects.length > 0 || ws.portfolio.claims.length > 0;
  if (hasPortfolioContent && ws.resumes.length === 0) {
    const missing = profileChecklist(ws).filter((item) => !item.done);
    if (missing.length > 0) {
      return {
        id: "preview",
        title: "Check your portfolio draft",
        description: `${missing.map((item) => item.hint).join(", ")}, then look at the local preview.`,
        href: "/portfolio",
        label: "Open Portfolio",
      };
    }
    return {
      id: "resume",
      title: "Create a resume",
      description: "Pick a target role and select approved projects, achievements, and skills.",
      href: "/resumes",
      label: "Go to Resumes",
    };
  }
  if (!hasPortfolioContent) {
    return {
      id: "evidence",
      title: "Add more evidence",
      description: "Every proposal has been decided and nothing is in the portfolio yet. Add an entry to propose something new.",
      href: "/sources",
      label: "Go to Sources",
    };
  }
  return {
    id: "maintain",
    title: "You're up to date",
    description: "No proposals are waiting. Add new work under Sources when you have it.",
    href: "/sources",
    label: "Go to Sources",
  };
}

export function recentEvidence(ws: Workspace, limit = 5): Evidence[] {
  return [...ws.evidence].sort((a, b) => b.capturedAt.localeCompare(a.capturedAt)).slice(0, limit);
}

export function pendingReviewItems(ws: Workspace, limit = 5): ReviewItem[] {
  return ws.reviewItems
    .filter(isPending)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .slice(0, limit);
}

export function recentActivity(ws: Workspace, limit = 5): ActivityEntry[] {
  return ws.activity.slice(0, limit);
}

export function portfolioCounts(ws: Workspace): { approvedClaims: number; visibleProjects: number; skills: number } {
  return {
    approvedClaims: ws.portfolio.claims.length,
    visibleProjects: ws.portfolio.projects.filter((project) => project.visible).length,
    skills: ws.portfolio.skills.length,
  };
}
