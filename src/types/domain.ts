import type { z } from "zod";
import type {
  activityEntrySchema,
  activityTypeSchema,
  claimOriginSchema,
  evidenceSchema,
  externalLinkSchema,
  portfolioClaimSchema,
  portfolioProjectSchema,
  providerIdSchema,
  publishingStateSchema,
  resumeDraftSchema,
  reviewItemSchema,
  reviewKindSchema,
  reviewStatusSchema,
  skillSchema,
  sourceItemKindSchema,
  sourceItemSchema,
  sourceSchema,
  sourceStatusSchema,
  userProfileSchema,
  verificationSchema,
  wordingSchema,
  workspaceSchema,
} from "@/lib/validation/domain";

/**
 * Domain types, inferred from the schemas in `src/lib/validation/domain.ts`
 * (architecture.md §5). The layers stay separate:
 *
 * - original source data: `Source`, `SourceItem`
 * - extracted evidence: `Evidence`
 * - generated or edited wording plus review state: `ReviewItem`
 * - reviewed content: `PortfolioClaim`, `PortfolioProject`, `Skill`
 * - publishing state: `PublishingState`
 */

export type ProviderId = z.infer<typeof providerIdSchema>;
export type SourceStatus = z.infer<typeof sourceStatusSchema>;
export type SourceItemKind = z.infer<typeof sourceItemKindSchema>;
export type Verification = z.infer<typeof verificationSchema>;
export type ClaimOrigin = z.infer<typeof claimOriginSchema>;
export type WordingOrigin = z.infer<typeof wordingSchema>;
export type ReviewKind = z.infer<typeof reviewKindSchema>;
export type ReviewStatus = z.infer<typeof reviewStatusSchema>;
export type ActivityType = z.infer<typeof activityTypeSchema>;

export type ExternalLink = z.infer<typeof externalLinkSchema>;
export type UserProfile = z.infer<typeof userProfileSchema>;
export type Source = z.infer<typeof sourceSchema>;
export type SourceItem = z.infer<typeof sourceItemSchema>;
export type Evidence = z.infer<typeof evidenceSchema>;
export type ReviewItem = z.infer<typeof reviewItemSchema>;
export type PortfolioProject = z.infer<typeof portfolioProjectSchema>;
export type PortfolioClaim = z.infer<typeof portfolioClaimSchema>;
export type Skill = z.infer<typeof skillSchema>;
export type PublishingState = z.infer<typeof publishingStateSchema>;
export type ResumeDraft = z.infer<typeof resumeDraftSchema>;
export type ActivityEntry = z.infer<typeof activityEntrySchema>;

/** The whole persisted document, version 1 (architecture.md §5.12). */
export type Workspace = z.infer<typeof workspaceSchema>;
