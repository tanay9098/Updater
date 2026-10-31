import type { ProviderId, SourceItemKind } from "@/types/domain";

/**
 * Source-provider contract (architecture.md §9). Descriptors are data: the
 * Sources page renders capabilities and permissions verbatim from them.
 *
 * - `available`: works in this version (Manual entries, GitHub public import).
 * - `demo`: loads labeled fixture data, never a real account.
 * - `planned`: not implemented. Exposes no operations, so the UI cannot
 *   render a connect button for it.
 */
export type ProviderAvailability = "available" | "demo" | "planned";

export type ProviderDescriptor = {
  id: ProviderId;
  displayName: string;
  kind: "local" | "code_host" | "publishing" | "fixture";
  availability: ProviderAvailability;
  /** What it provides, in one sentence. */
  summary: string;
  capabilities: ReadonlyArray<{ id: string; label: string; description: string }>;
  permissions: { reads: ReadonlyArray<string>; never: ReadonlyArray<string> };
  /** Realistic instructions, or the future flow for planned providers. */
  setupNotes: ReadonlyArray<string>;
  /** How synchronization works, stated truthfully. */
  syncNote: string;
  itemKinds: ReadonlyArray<SourceItemKind>;
};

/**
 * A page of raw items from a provider. The GitHub import
 * (`lib/providers/github`) returns its own listing shape instead, because
 * it pages internally on the server; blog adapters may use this.
 */
export type SyncPage = {
  /** Raw items. Validated by ingestion, never trusted. */
  items: unknown[];
  nextCursor?: string;
  rateLimit?: { remaining: number; resetAt: string };
};
