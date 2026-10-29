import { z } from "zod";
import { externalUrlSchema, optionalText, requiredText } from "./schemas";

/**
 * Entity schemas for the workspace document (architecture.md §5). Every
 * persisted, imported, or user-entered value passes through these. Types in
 * `src/types/domain.ts` are inferred from them, so there is one definition.
 *
 * Objects are strict: unknown keys are rejected. A persisted document can
 * therefore never carry a field the schema doesn't name, such as a token
 * (FR-DATA-03, rules.md §7.3.4).
 */

const id = z.string().min(1).max(80);
const timestamp = z.iso.datetime();
/** A reported date: either a calendar date (YYYY-MM-DD) or a full timestamp. */
const reportedDate = z.union([z.iso.date(), z.iso.datetime()]);
const plainText = (max: number) => z.string().max(max);

export const PROVIDER_IDS = ["manual", "demo", "github", "rss"] as const;
export const providerIdSchema = z.enum(PROVIDER_IDS);

export const SOURCE_STATUSES = [
  "connected",
  "not_connected",
  "needs_attention",
  "syncing",
  "unavailable",
  "planned",
  "demo",
] as const;
export const sourceStatusSchema = z.enum(SOURCE_STATUSES);

export const SOURCE_ITEM_KINDS = [
  "repository",
  "pull_request",
  "article",
  "contribution",
  "project",
  "achievement",
] as const;
export const sourceItemKindSchema = z.enum(SOURCE_ITEM_KINDS);

export const VERIFICATION_STATES = ["source_reported", "user_asserted", "conflicting", "unverified"] as const;
export const verificationSchema = z.enum(VERIFICATION_STATES);

export const CLAIM_ORIGINS = ["source", "user", "edited_from_source"] as const;
export const claimOriginSchema = z.enum(CLAIM_ORIGINS);

export const WORDING_ORIGINS = ["template", "user", "ai_draft"] as const;
export const wordingSchema = z.enum(WORDING_ORIGINS);

export const REVIEW_KINDS = ["add_project", "add_claim", "add_skill"] as const;
export const reviewKindSchema = z.enum(REVIEW_KINDS);

export const REVIEW_STATUSES = ["needs_review", "edited", "approved", "dismissed"] as const;
export const reviewStatusSchema = z.enum(REVIEW_STATUSES);

export const ACTIVITY_TYPES = [
  "profile_updated",
  "manual_entry_added",
  "demo_loaded",
  "demo_removed",
  "review_edited",
  "review_edit_reverted",
  "review_approved",
  "review_dismissed",
  "review_restored",
  "project_added",
  "project_updated",
  "project_deleted",
  "claim_added",
  "claim_updated",
  "claim_removed",
  "skill_added",
  "skill_removed",
  "resume_created",
  "resume_saved",
  "resume_deleted",
  "workspace_imported",
] as const;
export const activityTypeSchema = z.enum(ACTIVITY_TYPES);

// ---------------------------------------------------------------------------
// Form-level schemas (user input). Trimmed, with readable messages.
// ---------------------------------------------------------------------------

export const externalLinkInputSchema = z.object({
  label: requiredText("Label", 40),
  url: externalUrlSchema,
});

const emptyToUndefined = (value: string) => (value === "" ? undefined : value);

export const profileInputSchema = z.object({
  name: requiredText("Name", 100),
  headline: optionalText("Headline", 140),
  intro: optionalText("Introduction", 2000),
  location: optionalText("Location", 100).transform(emptyToUndefined),
  email: z
    .string()
    .trim()
    .max(254, "Email must be 254 characters or fewer.")
    .transform(emptyToUndefined)
    .pipe(z.email("Enter a valid email address, for example name@example.com.").optional()),
});
export type ProfileInput = z.input<typeof profileInputSchema>;

/** A comma-separated list typed by the user ("TypeScript, Postgres"). */
export const tagListSchema = (label: string) =>
  z
    .string()
    .max(400, `${label} must be 400 characters or fewer.`)
    .transform((value) => {
      // Keeps the first spelling of each entry, ignoring case.
      const seen = new Map<string, string>();
      for (const part of value.split(",")) {
        const trimmed = part.trim().slice(0, 40);
        if (trimmed && !seen.has(trimmed.toLowerCase())) seen.set(trimmed.toLowerCase(), trimmed);
      }
      return Array.from(seen.values()).slice(0, 30);
    });

export const optionalUrlSchema = z
  .string()
  .trim()
  .transform(emptyToUndefined)
  .pipe(externalUrlSchema.optional());

export const optionalDateSchema = z
  .string()
  .trim()
  .transform(emptyToUndefined)
  .pipe(z.iso.date("Enter a date as YYYY-MM-DD.").optional());

export const MANUAL_ENTRY_KINDS = ["project", "article", "contribution", "achievement"] as const;

export const manualEntryInputSchema = z.object({
  kind: z.enum(MANUAL_ENTRY_KINDS),
  title: requiredText("Title", 140),
  url: optionalUrlSchema,
  occurredAt: optionalDateSchema,
  description: requiredText("Description", 1000),
  technologies: tagListSchema("Technologies"),
  targetProjectId: z
    .string()
    .transform(emptyToUndefined)
    .optional(),
});
export type ManualEntryInput = z.input<typeof manualEntryInputSchema>;

export const projectInputSchema = z.object({
  name: requiredText("Project name", 100),
  summary: optionalText("Summary", 500),
  technologies: tagListSchema("Technologies"),
});
export type ProjectInput = z.input<typeof projectInputSchema>;

export const claimTextSchema = requiredText("Achievement", 500);
export const skillNameSchema = requiredText("Skill", 40);
export const reviewTextSchema = requiredText("Proposed text", 500);
export const dismissReasonSchema = optionalText("Reason", 200).transform(emptyToUndefined);

export const resumeCreateInputSchema = z.object({
  targetRole: requiredText("Target role", 100),
  name: optionalText("Resume name", 100),
});
export type ResumeCreateInput = z.input<typeof resumeCreateInputSchema>;

export const resumeDetailsInputSchema = z.object({
  name: requiredText("Resume name", 100),
  targetRole: requiredText("Target role", 100),
  summary: optionalText("Summary", 1200),
});

// ---------------------------------------------------------------------------
// Persisted entities.
// ---------------------------------------------------------------------------

export const externalLinkSchema = z.strictObject({
  id,
  label: plainText(40).min(1),
  url: externalUrlSchema,
});

export const userProfileSchema = z.strictObject({
  id,
  name: plainText(100).min(1),
  headline: plainText(140),
  intro: plainText(2000),
  location: plainText(100).optional(),
  email: z.email().max(254).optional(),
  links: z.array(externalLinkSchema).max(20),
  createdAt: timestamp,
  updatedAt: timestamp,
});

export const lastSyncSchema = z.strictObject({
  attemptedAt: timestamp,
  outcome: z.enum(["succeeded", "failed", "rate_limited"]),
  message: plainText(500).optional(),
  itemCount: z.number().int().nonnegative().optional(),
});

export const sourceSchema = z.strictObject({
  id,
  providerId: providerIdSchema,
  displayName: plainText(100).min(1),
  /** For example a GitHub username. Never a token. */
  accountLabel: plainText(100).optional(),
  status: sourceStatusSchema,
  lastSync: lastSyncSchema.optional(),
  isDemo: z.boolean(),
  createdAt: timestamp,
  updatedAt: timestamp,
});

const metadataValue = z.union([z.string().max(500), z.number(), z.boolean(), z.array(z.string().max(100)).max(50)]);

export const sourceItemSchema = z.strictObject({
  id,
  sourceId: id,
  externalId: plainText(200).min(1),
  kind: sourceItemKindSchema,
  title: plainText(200).min(1),
  url: externalUrlSchema.optional(),
  occurredAt: reportedDate.optional(),
  discoveredAt: timestamp,
  metadata: z.record(z.string().max(60), metadataValue),
  body: plainText(5000).optional(),
  isDemo: z.boolean(),
  createdAt: timestamp,
  updatedAt: timestamp,
});

export const evidenceFactSchema = z.strictObject({
  key: plainText(60).min(1),
  value: plainText(500),
});

export const evidenceSchema = z.strictObject({
  id,
  sourceItemId: id,
  kind: z.enum(["fact", "excerpt", "user_statement"]),
  statement: plainText(2000).min(1),
  facts: z.array(evidenceFactSchema).max(30).optional(),
  verification: verificationSchema,
  conflictsWith: z.array(id).optional(),
  capturedAt: timestamp,
  isDemo: z.boolean(),
});

export const proposedProjectSchema = z.strictObject({
  name: plainText(100).min(1),
  technologies: z.array(plainText(40)).max(30),
  links: z.array(externalLinkSchema).max(10),
});

export const reviewItemSchema = z
  .strictObject({
    id,
    kind: reviewKindSchema,
    /** The original proposal. Never changes after creation. */
    proposedText: plainText(500).min(1),
    editedText: plainText(500).min(1).optional(),
    proposedProject: proposedProjectSchema.optional(),
    targetProjectId: id.optional(),
    wording: wordingSchema,
    /** One sentence explaining which evidence fields produced the proposal. */
    rationale: plainText(300),
    evidenceIds: z.array(id).min(1),
    sourceItemId: id,
    status: reviewStatusSchema,
    dismissReason: plainText(200).optional(),
    conflictAcknowledgedAt: timestamp.optional(),
    decidedAt: timestamp.optional(),
    resultingClaimId: id.optional(),
    resultingProjectId: id.optional(),
    resultingSkillId: id.optional(),
    isDemo: z.boolean(),
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  .superRefine((item, ctx) => {
    if (item.status === "edited" && item.editedText === undefined) {
      ctx.addIssue({ code: "custom", message: "An edited item needs edited text.", path: ["editedText"] });
    }
    if (item.kind === "add_project" && !item.proposedProject) {
      ctx.addIssue({ code: "custom", message: "A project proposal needs project details.", path: ["proposedProject"] });
    }
  });

export const portfolioClaimSchema = z
  .strictObject({
    id,
    text: plainText(500).min(1),
    origin: claimOriginSchema,
    wording: wordingSchema,
    evidenceIds: z.array(id),
    projectId: id.optional(),
    reviewItemId: id.optional(),
    /** Set when the user removed the source this claim came from but chose to keep the claim. */
    sourceRemoved: z.boolean().optional(),
    approvedAt: timestamp,
    /** Set only by a real publisher. Never set in the MVP. */
    publishedAt: timestamp.optional(),
    isDemo: z.boolean(),
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  .superRefine((claim, ctx) => {
    if (claim.origin !== "user" && claim.evidenceIds.length === 0 && !claim.sourceRemoved) {
      ctx.addIssue({
        code: "custom",
        message: "A claim derived from a source needs at least one piece of evidence.",
        path: ["evidenceIds"],
      });
    }
  });

export const skillSchema = z.strictObject({
  id,
  name: plainText(40).min(1),
  origin: z.enum(["source", "user"]),
  evidenceIds: z.array(id),
  visible: z.boolean(),
  reviewItemId: id.optional(),
  sourceRemoved: z.boolean().optional(),
  isDemo: z.boolean(),
  createdAt: timestamp,
  updatedAt: timestamp,
});

export const portfolioProjectSchema = z.strictObject({
  id,
  name: plainText(100).min(1),
  /** The user's own summary. Used when the project has no summary claim. */
  summary: plainText(500),
  /** Claim holding the source-backed project description, if any. */
  summaryClaimId: id.optional(),
  technologies: z.array(plainText(40)).max(30),
  links: z.array(externalLinkSchema).max(10),
  /** Ordered achievements. */
  claimIds: z.array(id),
  sourceItemIds: z.array(id),
  visible: z.boolean(),
  sourceRemoved: z.boolean().optional(),
  isDemo: z.boolean(),
  createdAt: timestamp,
  updatedAt: timestamp,
});

/** The MVP has no publisher, so only the unpublished state is valid (architecture.md §5.10, §7.4). */
export const publishingStateSchema = z.strictObject({
  publisherId: z.null(),
  status: z.literal("not_published"),
});

export const resumeDraftSchema = z.strictObject({
  id,
  name: plainText(100).min(1),
  targetRole: plainText(100).min(1),
  summary: plainText(1200),
  projectIds: z.array(id),
  claimIds: z.array(id),
  skillIds: z.array(id),
  /** Per-resume wording. Never changes the underlying claim. */
  overrides: z.record(id, plainText(500)),
  includeContact: z.boolean(),
  createdAt: timestamp,
  updatedAt: timestamp,
});

export const activityEntrySchema = z.strictObject({
  id,
  at: timestamp,
  type: activityTypeSchema,
  summary: plainText(300),
  refId: id.optional(),
});

export const onboardingSchema = z.strictObject({
  completedAt: timestamp.optional(),
  startChoice: z.enum(["manual", "demo", "skipped"]).optional(),
});

export const WORKSPACE_SCHEMA_VERSION = 1;
export const MAX_ACTIVITY_ENTRIES = 50;

export const workspaceSchema = z
  .strictObject({
    schemaVersion: z.literal(WORKSPACE_SCHEMA_VERSION),
    profile: userProfileSchema.nullable(),
    onboarding: onboardingSchema,
    sources: z.array(sourceSchema),
    sourceItems: z.array(sourceItemSchema),
    evidence: z.array(evidenceSchema),
    reviewItems: z.array(reviewItemSchema),
    portfolio: z.strictObject({
      projects: z.array(portfolioProjectSchema),
      claims: z.array(portfolioClaimSchema),
      skills: z.array(skillSchema),
      publishing: publishingStateSchema,
    }),
    resumes: z.array(resumeDraftSchema),
    activity: z.array(activityEntrySchema).max(MAX_ACTIVITY_ENTRIES),
  })
  .superRefine((ws, ctx) => {
    // Hard references: the provenance chain must be intact (rules.md §7.1.3).
    const sourceIds = new Set(ws.sources.map((source) => source.id));
    const itemIds = new Set(ws.sourceItems.map((item) => item.id));
    const evidenceIds = new Set(ws.evidence.map((evidence) => evidence.id));
    const seenExternal = new Set<string>();

    ws.sources.forEach((source, index) => {
      if (!providerCanProduce(source.providerId, source.status)) {
        ctx.addIssue({
          code: "custom",
          message: `Provider "${source.providerId}" cannot have status "${source.status}".`,
          path: ["sources", index, "status"],
        });
      }
    });
    ws.sourceItems.forEach((item, index) => {
      if (!sourceIds.has(item.sourceId)) {
        ctx.addIssue({ code: "custom", message: "Unknown source.", path: ["sourceItems", index, "sourceId"] });
      }
      const key = `${item.sourceId}\u0000${item.externalId}`;
      if (seenExternal.has(key)) {
        ctx.addIssue({ code: "custom", message: "Duplicate source item.", path: ["sourceItems", index, "externalId"] });
      }
      seenExternal.add(key);
    });
    ws.evidence.forEach((evidence, index) => {
      if (!itemIds.has(evidence.sourceItemId)) {
        ctx.addIssue({ code: "custom", message: "Unknown source item.", path: ["evidence", index, "sourceItemId"] });
      }
    });
    ws.reviewItems.forEach((item, index) => {
      if (!itemIds.has(item.sourceItemId)) {
        ctx.addIssue({ code: "custom", message: "Unknown source item.", path: ["reviewItems", index, "sourceItemId"] });
      }
      if (item.evidenceIds.some((evidenceId) => !evidenceIds.has(evidenceId))) {
        ctx.addIssue({ code: "custom", message: "Unknown evidence.", path: ["reviewItems", index, "evidenceIds"] });
      }
    });
    ws.portfolio.claims.forEach((claim, index) => {
      if (claim.evidenceIds.some((evidenceId) => !evidenceIds.has(evidenceId))) {
        ctx.addIssue({ code: "custom", message: "Unknown evidence.", path: ["portfolio", "claims", index, "evidenceIds"] });
      }
    });
  });

/**
 * Which statuses each provider can genuinely produce (architecture.md §7.3).
 * Planned providers produce nothing in the MVP, so they cannot have a stored
 * source at all, let alone a connected one.
 */
export function providerCanProduce(
  providerId: z.infer<typeof providerIdSchema>,
  status: z.infer<typeof sourceStatusSchema>,
): boolean {
  switch (providerId) {
    case "manual":
      return status === "connected";
    case "demo":
      return status === "demo";
    case "github":
    case "rss":
      return false;
  }
}
