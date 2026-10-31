import { CircleCheck, Globe, PenLine, Sparkles, UserRound, Wand2 } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import type { StatusTone } from "@/components/ui/status";
import type { ClaimOrigin, PublishingStatus, ReviewStatus, Verification, WordingOrigin } from "@/types/domain";

/** Violet "Demo data" label on every demo-derived surface (FR-SRC-03, design.md §16). */
export function DemoBadge() {
  return <StatusBadge tone="demo" label="Demo data" />;
}

const REVIEW_STATUS: Record<ReviewStatus, { label: string; tone: StatusTone }> = {
  needs_review: { label: "Needs review", tone: "warning" },
  edited: { label: "Edited", tone: "info" },
  approved: { label: "Approved", tone: "success" },
  dismissed: { label: "Dismissed", tone: "neutral" },
};

export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  needs_review: "Needs review",
  edited: "Edited",
  approved: "Approved",
  dismissed: "Dismissed",
};

export function ReviewStatusBadge({ status }: { status: ReviewStatus }) {
  const { label, tone } = REVIEW_STATUS[status];
  return <StatusBadge tone={tone} label={label} icon={status === "edited" ? PenLine : undefined} />;
}

const VERIFICATION: Record<Verification, { label: string; tone: StatusTone; description: string }> = {
  source_reported: {
    label: "From source",
    tone: "info",
    description: "Taken from what the source reported. Updater did not check it independently.",
  },
  user_asserted: {
    label: "User-supplied",
    tone: "neutral",
    description: "You stated this. It is not externally verified.",
  },
  unverified: { label: "Unverified", tone: "neutral", description: "Imported but not checked." },
  conflicting: {
    label: "Conflict",
    tone: "warning",
    description: "Disagrees with other evidence for the same item.",
  },
};

export function verificationDescription(verification: Verification): string {
  return VERIFICATION[verification].description;
}

export function VerificationBadge({ verification }: { verification: Verification }) {
  const { label, tone } = VERIFICATION[verification];
  return <StatusBadge tone={tone} label={label} icon={verification === "user_asserted" ? UserRound : undefined} />;
}

const ORIGIN: Record<ClaimOrigin, { label: string; tone: StatusTone }> = {
  source: { label: "Source", tone: "info" },
  user: { label: "User-supplied", tone: "neutral" },
  edited_from_source: { label: "Edited from source", tone: "info" },
};

export function OriginBadge({ origin }: { origin: ClaimOrigin }) {
  const { label, tone } = ORIGIN[origin];
  return (
    <StatusBadge
      tone={tone}
      label={label}
      icon={origin === "user" ? UserRound : origin === "edited_from_source" ? PenLine : CircleCheck}
    />
  );
}

const WORDING: Record<WordingOrigin, string> = {
  template: "Template wording from source fields",
  user: "Your wording",
  ai_draft: "AI draft",
};

/** Who produced the current wording (design.md §10, §16). The MVP never uses AI. */
export function WordingLabel({ wording }: { wording: WordingOrigin }) {
  const Icon = wording === "template" ? Wand2 : wording === "ai_draft" ? Sparkles : UserRound;
  return (
    <span className="inline-flex items-center gap-1.5 text-meta font-medium text-muted">
      <Icon aria-hidden="true" size={14} strokeWidth={1.75} />
      {WORDING[wording]}
    </span>
  );
}

const PUBLICATION: Record<PublishingStatus, { label: string; tone: StatusTone }> = {
  not_published: { label: "Not published", tone: "neutral" },
  publishing: { label: "Publishing", tone: "info" },
  // Only after GitHub Pages confirmed the build (rules.md §7.1.9).
  published: { label: "Published", tone: "success" },
  failed: { label: "Publish failed", tone: "error" },
};

/** Publication state (design.md §9), from the workspace's publishing record. */
export function PublicationBadge({ status }: { status: PublishingStatus }) {
  const { label, tone } = PUBLICATION[status];
  return <StatusBadge tone={tone} label={label} icon={Globe} />;
}
