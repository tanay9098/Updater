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

/**
 * GitHub, read-only public repository import (T10.1). Not an account
 * connection: there is no authorization, so it is labeled "Public import",
 * never "Connected" (rules.md §7.1.7). Pull requests need T10.3.
 */
export const GITHUB_PROVIDER: ProviderDescriptor = {
  id: "github",
  displayName: "GitHub",
  kind: "code_host",
  availability: "available",
  summary: "Public repositories you own, with links reviewers can verify.",
  capabilities: [
    {
      id: "repositories",
      label: "Public repositories",
      description: "Name, description, primary language, topics, license, creation date, and URL. Forks are left out.",
    },
    {
      id: "pull_requests",
      label: "Pull requests (planned)",
      description: "Merged pull requests to other projects aren't imported yet.",
    },
  ],
  permissions: {
    reads: ["Public repository data for the username you enter, through GitHub's public API. No sign-in to GitHub."],
    never: [
      "The import never writes to GitHub. (Publishing your portfolio is separate: it writes only to the repository you choose on the Portfolio page.)",
      "Never reads private repositories.",
      "Never sends your workspace to GitHub: only the username is sent, by Updater's server.",
    ],
  },
  setupNotes: [
    "Enter a GitHub username, review the public repositories found, and choose which to import. Each becomes a proposal in the Review Queue.",
    "Updater can't confirm that the account is yours. Import only your own repositories.",
  ],
  syncNote: "Imported when you ask. Use “Check for updates” to refresh; nothing syncs in the background.",
  itemKinds: ["repository"],
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
 * entries are always usable locally (`connected`, shown as "Local"). GitHub
 * is `not_connected` until an import succeeds, then whatever the source
 * recorded (`connected`, or `needs_attention` after a failed check). The demo
 * provider is `demo` only while fixtures are loaded.
 */
export function providerStatus(provider: ProviderDescriptor, ws: Workspace): SourceStatus {
  switch (provider.availability) {
    case "planned":
      return "planned";
    case "available":
      // Manual entries always work locally. A remote provider's status is what its source recorded.
      if (provider.kind === "local") return "connected";
      return findSourceForProvider(ws, provider.id)?.status ?? "not_connected";
    case "demo":
      return findSourceForProvider(ws, provider.id) ? "demo" : "not_connected";
  }
}

export type StatusPresentation = {
  label: string;
  tone: "success" | "warning" | "error" | "info" | "neutral" | "demo" | "planned";
};

/** Badge label and tone (design.md §9). Manual entries read "Local" and GitHub "Public import", never "Connected". */
export function presentStatus(provider: ProviderDescriptor, status: SourceStatus): StatusPresentation {
  switch (status) {
    case "connected":
      if (provider.kind === "local") return { label: "Local", tone: "success" };
      // A public import isn't an authorized connection (rules.md §7.1.7).
      if (provider.id === "github") return { label: "Public import", tone: "success" };
      return { label: "Connected", tone: "success" };
    case "not_connected":
      if (provider.kind === "fixture") return { label: "Not loaded", tone: "neutral" };
      if (provider.id === "github") return { label: "Not set up", tone: "neutral" };
      return { label: "Not connected", tone: "neutral" };
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
