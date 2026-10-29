import type { ProviderId, Source, SourceStatus, Workspace } from "@/types/domain";
import type { ProviderDescriptor } from "./types";

/** Manual entries: the one source that genuinely works in the MVP. Local only. */
export const MANUAL_PROVIDER: ProviderDescriptor = {
  id: "manual",
  displayName: "Manual entries",
  kind: "local",
  availability: "available",
  summary: "Projects, articles, contributions, and achievements you add yourself.",
  capabilities: [
    {
      id: "add_entry",
      label: "Add entries",
      description: "Record a project, article, contribution, or achievement with an optional link and date.",
    },
    {
      id: "user_statements",
      label: "User-supplied evidence",
      description: "Your description is stored as a user-supplied statement, not as externally verified evidence.",
    },
  ],
  permissions: {
    reads: ["Only what you type into the form."],
    never: ["Never contacts another service.", "Never sends your entries anywhere."],
  },
  setupNotes: ["Nothing to set up. Use “Add entry” to record work."],
  syncNote: "Not synchronized: entries are added manually.",
  itemKinds: ["project", "article", "contribution", "achievement"],
};

/** Demo workspace: fictional fixtures, labeled everywhere (D-010). */
export const DEMO_PROVIDER: ProviderDescriptor = {
  id: "demo",
  displayName: "Demo workspace",
  kind: "fixture",
  availability: "demo",
  summary: "Fictional sample repositories, pull requests, and an article for exploring Updater.",
  capabilities: [
    {
      id: "fixtures",
      label: "Sample evidence",
      description: "Loads fictional source items with evidence and proposals so you can try the review queue.",
    },
  ],
  permissions: {
    reads: ["Fixture data bundled with Updater."],
    never: ["Never connects to a real account.", "Never represents real activity: every link points to example.com."],
  },
  setupNotes: ["Load it to explore. Remove it any time, here or in Settings."],
  syncNote: "Not synchronized: fixture data is loaded once.",
  itemKinds: ["repository", "pull_request", "article"],
};

export const GITHUB_PROVIDER: ProviderDescriptor = {
  id: "github",
  displayName: "GitHub",
  kind: "code_host",
  availability: "planned",
  summary: "Your public repositories and merged pull requests, with links reviewers can verify.",
  capabilities: [
    { id: "repositories", label: "Repositories", description: "Name, description, topics, primary language, and URL." },
    { id: "pull_requests", label: "Merged pull requests", description: "Title, repository, merge date, and URL." },
  ],
  permissions: {
    reads: ["Public repositories and pull requests (read-only)."],
    never: ["Never writes to your account.", "Never reads private code without a separate, explicit grant."],
  },
  setupNotes: [
    "Not available yet.",
    "Planned flow: you'll sign in with GitHub and grant read-only access to public repositories. Updater's server keeps the authorization; this browser never stores a token.",
  ],
  syncNote: "Not synchronized: this integration isn't built yet.",
  itemKinds: ["repository", "pull_request", "contribution"],
};

export const RSS_PROVIDER: ProviderDescriptor = {
  id: "rss",
  displayName: "Blog feeds (RSS/Atom)",
  kind: "publishing",
  availability: "planned",
  summary: "Articles you publish, read from your blog's public feed.",
  capabilities: [{ id: "articles", label: "Articles", description: "Title, publication date, and URL." }],
  permissions: {
    reads: ["The public feed URL you provide."],
    never: ["Never posts to your blog.", "Never needs a password."],
  },
  setupNotes: [
    "Not available yet.",
    "Planned flow: you'll paste your feed URL. Updater's server will fetch it and propose new articles for review.",
  ],
  syncNote: "Not synchronized: this integration isn't built yet.",
  itemKinds: ["article"],
};

export const PROVIDERS: ReadonlyArray<ProviderDescriptor> = [
  MANUAL_PROVIDER,
  DEMO_PROVIDER,
  GITHUB_PROVIDER,
  RSS_PROVIDER,
];

export function getProvider(id: ProviderId): ProviderDescriptor {
  const provider = PROVIDERS.find((candidate) => candidate.id === id);
  if (!provider) throw new Error(`Unknown provider: ${id}`);
  return provider;
}

export function findSourceForProvider(ws: Workspace, providerId: ProviderId): Source | undefined {
  return ws.sources.find((source) => source.providerId === providerId);
}

/**
 * The status shown for a provider, derived from real state only
 * (architecture.md §7.3). A planned provider is always `planned`. Manual
 * entries are always usable locally (`connected`, shown as "Local"). The demo
 * provider is `demo` only while fixtures are loaded.
 */
export function providerStatus(provider: ProviderDescriptor, ws: Workspace): SourceStatus {
  switch (provider.availability) {
    case "planned":
      return "planned";
    case "available":
      return "connected";
    case "demo":
      return findSourceForProvider(ws, provider.id) ? "demo" : "not_connected";
  }
}

export type StatusPresentation = {
  label: string;
  tone: "success" | "warning" | "error" | "info" | "neutral" | "demo" | "planned";
};

/** Badge label and tone (design.md §9). Manual entries read "Local", never "Connected". */
export function presentStatus(provider: ProviderDescriptor, status: SourceStatus): StatusPresentation {
  switch (status) {
    case "connected":
      return provider.kind === "local" ? { label: "Local", tone: "success" } : { label: "Connected", tone: "success" };
    case "not_connected":
      return provider.kind === "fixture" ? { label: "Not loaded", tone: "neutral" } : { label: "Not connected", tone: "neutral" };
    case "needs_attention":
      return { label: "Needs attention", tone: "warning" };
    case "syncing":
      return { label: "Syncing", tone: "info" };
    case "unavailable":
      return { label: "Unavailable", tone: "neutral" };
    case "planned":
      return { label: "Planned", tone: "planned" };
    case "demo":
      return { label: "Demo data", tone: "demo" };
  }
}
