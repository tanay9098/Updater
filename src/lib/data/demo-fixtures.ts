import type { RawSourceItem } from "@/features/sources/ingestion";

/**
 * Demo workspace fixtures (D-010, rules.md §7.1.6).
 *
 * Everything here is fictional: the projects, the upstream repositories,
 * and the article do not exist, and every link uses the reserved
 * example.com domain. Items are flagged `isDemo` when ingested and carry a
 * "Demo data" label on every surface. The license disagreement on
 * trail-notes is deliberate, so the conflict workflow can be tried.
 */
export const DEMO_SOURCE_NAME = "Demo workspace (fictional)";

export const DEMO_ITEMS: ReadonlyArray<RawSourceItem> = [
  {
    externalId: "demo-repo-trail-notes",
    kind: "repository",
    title: "trail-notes",
    url: "https://example.com/demo/repos/trail-notes",
    occurredAt: "2026-06-14",
    metadata: {
      description: "Offline-first note-taking app for hiking trips, with map pins and sync when back online",
      language: "TypeScript",
      topics: ["offline-first", "pwa", "indexeddb"],
      license: "MIT",
    },
    excerpts: [
      {
        statement: "From the README: “trail-notes is released under the Apache-2.0 license.”",
        facts: [{ key: "license", value: "Apache-2.0" }],
      },
    ],
  },
  {
    externalId: "demo-repo-tidepool",
    kind: "repository",
    title: "tidepool",
    url: "https://example.com/demo/repos/tidepool",
    occurredAt: "2026-03-02",
    metadata: {
      description: "Command-line tool that summarizes tide tables from public CSV files",
      language: "Go",
      topics: ["cli", "csv"],
    },
  },
  {
    externalId: "demo-repo-lantern-forms",
    kind: "repository",
    title: "lantern-forms",
    url: "https://example.com/demo/repos/lantern-forms",
    occurredAt: "2025-11-20",
    metadata: {
      description: "Accessible form components for React with built-in validation messages",
      language: "TypeScript",
      topics: ["react", "accessibility", "forms"],
    },
  },
  {
    externalId: "demo-pr-harbor-cache-412",
    kind: "pull_request",
    title: "Add retry with backoff to the cache client",
    url: "https://example.com/demo/harbor-cache/pull/412",
    occurredAt: "2026-08-09",
    metadata: { repository: "harbor-cache", state: "merged" },
  },
  {
    externalId: "demo-pr-quillmark-87",
    kind: "pull_request",
    title: "Fix heading anchors for non-Latin titles",
    url: "https://example.com/demo/quillmark/pull/87",
    occurredAt: "2026-05-21",
    metadata: { repository: "quillmark", state: "merged" },
  },
  {
    externalId: "demo-article-offline-sync",
    kind: "article",
    title: "Designing offline sync for a small PWA",
    url: "https://example.com/demo/blog/offline-sync",
    occurredAt: "2026-07-03",
    metadata: { publication: "the demo blog" },
  },
];
