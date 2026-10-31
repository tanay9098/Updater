import { z } from "zod";
import type { PublicPortfolio, PublishConfirmations } from "@/lib/validation/publication";
import { installUrl, type GithubAppConfig } from "./config";
import { createAppJwt, fail, githubRequest, unexpected, type GithubDeps, type Outcome } from "./github-api";
import { MARKER_FILE, renderSite } from "./render";

/**
 * GitHub Pages publisher (T10.9, architecture.md §13, D-037). Publishes the
 * public copy of a portfolio to the developer's own user-site repository,
 * `<login>.github.io`, through Updater's GitHub App:
 *
 * 1. Find the app's installation on the linked GitHub account, and mint an
 *    installation token limited to that one repository.
 * 2. Check the repository, its `gh-pages` branch, and its Pages settings.
 *    Updater refuses to replace a `gh-pages` branch it didn't write, or to
 *    change what Pages serves, unless the developer confirmed it.
 * 3. Commit the rendered site as the whole content of `gh-pages`.
 * 4. Turn on Pages for `gh-pages` if needed. If GitHub refuses, the
 *    developer turns it on in the repository settings.
 *
 * Updater never writes to any other branch or repository. The site, its
 * history, and `portfolio.json` stay in the developer's account.
 */

export const PAGES_BRANCH = "gh-pages";
export const COMMIT_MESSAGE = "Updater: publish portfolio";

export type ReadyConfig = Extract<GithubAppConfig, { state: "ready" }>;

/** The GitHub account the signed-in Updater account linked (`lib/server/site-link.ts`). */
export type SiteLink = { githubUserId: number; login: string };

export type PagesSettings =
  | { state: "not_enabled" }
  | { state: "serving_updater"; url: string }
  | { state: "serving_other"; url: string; source: string };

export type SiteInfo = {
  login: string;
  /** `owner/<owner>.github.io`, spelled as GitHub spells it. */
  repository: string;
  private: boolean;
  /** The address GitHub serves the site at, or will once Pages is on. */
  siteUrl: string;
  settingsUrl: string;
  pages: PagesSettings;
};

export type Inspection =
  | { state: "not_installed"; login: string; installUrl: string }
  | { state: "repository_missing"; login: string; repository: string; installUrl: string; createUrl: string }
  | { state: "ready"; site: SiteInfo; token: string };

const installationSchema = z.object({
  id: z.number().int().positive(),
  account: z.object({ id: z.number().int().positive(), login: z.string() }).nullable(),
});
const tokenSchema = z.object({ token: z.string().min(1) });
const repositorySchema = z.object({
  full_name: z.string().regex(/^[A-Za-z0-9-]{1,39}\/[A-Za-z0-9._-]{1,100}$/),
  name: z.string(),
  private: z.boolean(),
  owner: z.object({ id: z.number().int().positive(), login: z.string() }),
});
const pagesSchema = z.object({
  html_url: z.string().nullable().optional(),
  build_type: z.string().nullable().optional(),
  source: z.object({ branch: z.string(), path: z.string() }).nullable().optional(),
});
const refSchema = z.object({ object: z.object({ sha: z.string() }) });
const commitSchema = z.object({ sha: z.string(), tree: z.object({ sha: z.string() }) });
const treeSchema = z.object({ sha: z.string(), tree: z.array(z.object({ path: z.string() })).optional() });
const createdSchema = z.object({ sha: z.string().regex(/^[0-9a-f]{40}$/) });
const buildSchema = z.object({
  status: z.string().nullable(),
  commit: z.string().nullable().optional(),
  error: z.object({ message: z.string().nullable().optional() }).nullable().optional(),
  updated_at: z.string().nullable().optional(),
});

export function siteRepositoryName(login: string): string {
  return `${login}.github.io`;
}

export function expectedSiteUrl(login: string): string {
  return `https://${login.toLowerCase()}.github.io/`;
}

function describeSource(pages: z.infer<typeof pagesSchema>): string {
  if (pages.build_type === "workflow") return "a GitHub Actions workflow";
  if (!pages.source) return "another source";
  return `the ${pages.source.branch} branch, ${pages.source.path} folder`;
}

function pagesSettings(pages: z.infer<typeof pagesSchema>, fallbackUrl: string): PagesSettings {
  const url = pages.html_url || fallbackUrl;
  const servesUpdater = pages.build_type !== "workflow" && pages.source?.branch === PAGES_BRANCH && pages.source.path === "/";
  return servesUpdater ? { state: "serving_updater", url } : { state: "serving_other", url, source: describeSource(pages) };
}

/** Steps 1–2 without writing anything: is the app installed, is the repository there, what does Pages serve. */
export async function inspectSite(deps: GithubDeps, config: ReadyConfig, link: SiteLink): Promise<Outcome<Inspection>> {
  const install = installUrl(config.slug);
  const jwt = await createAppJwt(config.appId, config.privateKey, deps.now());

  const found = await githubRequest(deps, { path: `/users/${encodeURIComponent(link.login)}/installation`, auth: `Bearer ${jwt}` });
  if (!found.ok) return found;
  if (found.value.status === 404) return { ok: true, value: { state: "not_installed", login: link.login, installUrl: install } };
  if (found.value.status === 401) {
    return fail("not_configured", "GitHub rejected this server's app credentials. The server's GitHub App settings need to be checked.");
  }
  if (found.value.status !== 200) return unexpected(found.value.status, "looking for the app installation");
  const installation = installationSchema.safeParse(found.value.data);
  if (!installation.success) return unexpected(found.value.status, "looking for the app installation");
  // A login can change hands. Only the account that was verified when linking counts.
  if (installation.data.account?.id !== link.githubUserId) {
    return { ok: true, value: { state: "not_installed", login: link.login, installUrl: install } };
  }

  const repositoryName = siteRepositoryName(link.login);
  const missing: Inspection = {
    state: "repository_missing",
    login: link.login,
    repository: `${link.login}/${repositoryName}`,
    installUrl: install,
    createUrl: `https://github.com/new?name=${encodeURIComponent(repositoryName)}&visibility=public`,
  };

  // Least privilege: a token for this one repository and only the permissions publishing needs.
  const minted = await githubRequest(deps, {
    method: "POST",
    path: `/app/installations/${installation.data.id}/access_tokens`,
    auth: `Bearer ${jwt}`,
    body: { repositories: [repositoryName], permissions: { contents: "write", pages: "write", metadata: "read" } },
  });
  if (!minted.ok) return minted;
  if (minted.value.status === 422 || minted.value.status === 404) return { ok: true, value: missing };
  if (minted.value.status !== 201) return unexpected(minted.value.status, "requesting access to the repository");
  const token = tokenSchema.safeParse(minted.value.data);
  if (!token.success) return unexpected(minted.value.status, "requesting access to the repository");
  const auth = `Bearer ${token.data.token}`;

  const repo = await githubRequest(deps, { path: `/repos/${encodeURIComponent(link.login)}/${encodeURIComponent(repositoryName)}`, auth });
  if (!repo.ok) return repo;
  if (repo.value.status === 404) return { ok: true, value: missing };
  if (repo.value.status !== 200) return unexpected(repo.value.status, "reading the repository");
  const repository = repositorySchema.safeParse(repo.value.data);
  if (!repository.success || repository.data.owner.id !== link.githubUserId) return { ok: true, value: missing };

  const fullName = repository.data.full_name;
  const pages = await githubRequest(deps, { path: `/repos/${fullName}/pages`, auth });
  if (!pages.ok) return pages;
  const fallbackUrl = expectedSiteUrl(link.login);
  let settings: PagesSettings;
  if (pages.value.status === 404) settings = { state: "not_enabled" };
  else if (pages.value.status === 200) {
    const parsed = pagesSchema.safeParse(pages.value.data);
    if (!parsed.success) return unexpected(pages.value.status, "reading the GitHub Pages settings");
    settings = pagesSettings(parsed.data, fallbackUrl);
  } else return unexpected(pages.value.status, "reading the GitHub Pages settings");

  return {
    ok: true,
    value: {
      state: "ready",
      token: token.data.token,
      site: {
        login: link.login,
        repository: fullName,
        private: repository.data.private,
        siteUrl: settings.state === "not_enabled" ? fallbackUrl : settings.url,
        settingsUrl: `https://github.com/${fullName}/settings/pages`,
        pages: settings,
      },
    },
  };
}

export type PublishResult = {
  repository: string;
  commitSha: string;
  siteUrl: string;
  settingsUrl: string;
  /** `manual`: the site is committed, but GitHub refused to turn Pages on; the developer does it in the settings. */
  pagesSetup: "ready" | "manual";
};

function notReady(inspection: Exclude<Inspection, { state: "ready" }>): Outcome<never> {
  return inspection.state === "not_installed"
    ? fail("not_installed", `Updater's GitHub App isn't installed on ${inspection.login}'s GitHub account.`)
    : fail("repository_missing", `Updater can't use ${inspection.repository}. Create it, then give the app access to it.`);
}

/** Steps 1–4. Writes only to the `gh-pages` branch of `<login>.github.io`. */
export async function publishSite(
  deps: GithubDeps,
  config: ReadyConfig,
  link: SiteLink,
  portfolio: PublicPortfolio,
  confirm: PublishConfirmations,
): Promise<Outcome<PublishResult>> {
  const inspected = await inspectSite(deps, config, link);
  if (!inspected.ok) return inspected;
  if (inspected.value.state !== "ready") return notReady(inspected.value);
  const { site, token } = inspected.value;
  const auth = `Bearer ${token}`;
  const repo = `/repos/${site.repository}`;

  // What is on gh-pages today, and did Updater write it?
  const ref = await githubRequest(deps, { path: `${repo}/git/ref/heads/${PAGES_BRANCH}`, auth });
  if (!ref.ok) return ref;
  if (ref.value.status === 409) return emptyRepository(site.repository);
  let head: string | null = null;
  if (ref.value.status === 200) {
    const parsed = refSchema.safeParse(ref.value.data);
    if (!parsed.success) return unexpected(ref.value.status, "reading the gh-pages branch");
    head = parsed.data.object.sha;
    if (!confirm.replaceBranch) {
      const ours = await branchHasMarker(deps, auth, repo, head);
      if (!ours.ok) return ours;
      if (!ours.value) {
        return fail(
          "branch_in_use",
          `${site.repository} already has a gh-pages branch that Updater didn't create. Publishing replaces its files (its history is kept).`,
        );
      }
    }
  } else if (ref.value.status !== 404) return unexpected(ref.value.status, "reading the gh-pages branch");

  if (site.pages.state === "serving_other" && !confirm.switchPagesSource) {
    return fail(
      "pages_source_conflict",
      `GitHub Pages for ${site.repository} currently publishes ${site.pages.source}. Publishing switches it to Updater's gh-pages branch.`,
      { currentSource: site.pages.source },
    );
  }

  // Commit the site as the whole content of the branch.
  const { files } = renderSite(portfolio, deps.now().toISOString());
  const tree = await githubRequest(deps, {
    method: "POST",
    path: `${repo}/git/trees`,
    auth,
    body: { tree: files.map((file) => ({ path: file.path, mode: "100644", type: "blob", content: file.content })) },
  });
  if (!tree.ok) return tree;
  if (tree.value.status === 409) return emptyRepository(site.repository);
  const treeSha = createdSchema.safeParse(tree.value.data);
  if (tree.value.status !== 201 || !treeSha.success) return unexpected(tree.value.status, "uploading the site files");

  const commit = await githubRequest(deps, {
    method: "POST",
    path: `${repo}/git/commits`,
    auth,
    body: { message: COMMIT_MESSAGE, tree: treeSha.data.sha, parents: head ? [head] : [] },
  });
  if (!commit.ok) return commit;
  const commitSha = createdSchema.safeParse(commit.value.data);
  if (commit.value.status !== 201 || !commitSha.success) return unexpected(commit.value.status, "creating the commit");

  const moved = head
    ? await githubRequest(deps, { method: "PATCH", path: `${repo}/git/refs/heads/${PAGES_BRANCH}`, auth, body: { sha: commitSha.data.sha, force: false } })
    : await githubRequest(deps, { method: "POST", path: `${repo}/git/refs`, auth, body: { ref: `refs/heads/${PAGES_BRANCH}`, sha: commitSha.data.sha } });
  if (!moved.ok) return moved;
  if (moved.value.status === 422 || moved.value.status === 409) {
    return fail("branch_changed", "The gh-pages branch changed while publishing. Nothing was replaced. Publish again.");
  }
  if (moved.value.status !== 200 && moved.value.status !== 201) return unexpected(moved.value.status, "updating the gh-pages branch");

  // Point Pages at the branch. A refusal here leaves a committed site that the developer turns on themselves.
  let pagesSetup: PublishResult["pagesSetup"] = "ready";
  if (site.pages.state !== "serving_updater") {
    const configured = await githubRequest(deps, {
      method: site.pages.state === "not_enabled" ? "POST" : "PUT",
      path: `${repo}/pages`,
      auth,
      body: { build_type: "legacy", source: { branch: PAGES_BRANCH, path: "/" } },
    });
    // The site is already committed, so any failure here is reported as a manual step, not as a failed publish.
    const status = configured.ok ? configured.value.status : 0;
    if (status !== 201 && status !== 204 && status !== 200) pagesSetup = "manual";
  }

  return {
    ok: true,
    value: { repository: site.repository, commitSha: commitSha.data.sha, siteUrl: site.siteUrl, settingsUrl: site.settingsUrl, pagesSetup },
  };
}

function emptyRepository(repository: string): Outcome<never> {
  return fail("repository_empty", `${repository} is empty. Add a README file to it on GitHub, then publish again.`);
}

async function branchHasMarker(deps: GithubDeps, auth: string, repo: string, head: string): Promise<Outcome<boolean>> {
  const commit = await githubRequest(deps, { path: `${repo}/git/commits/${head}`, auth });
  if (!commit.ok) return commit;
  const parsedCommit = commitSchema.safeParse(commit.value.data);
  if (commit.value.status !== 200 || !parsedCommit.success) return unexpected(commit.value.status, "reading the gh-pages branch");
  const tree = await githubRequest(deps, { path: `${repo}/git/trees/${parsedCommit.data.tree.sha}`, auth });
  if (!tree.ok) return tree;
  const parsedTree = treeSchema.safeParse(tree.value.data);
  if (tree.value.status !== 200 || !parsedTree.success) return unexpected(tree.value.status, "reading the gh-pages branch");
  return { ok: true, value: (parsedTree.data.tree ?? []).some((entry) => entry.path === MARKER_FILE) };
}

export type BuildStatus =
  | { state: "building" }
  | { state: "built"; url: string; builtAt: string }
  | { state: "errored"; message: string }
  /** Another publish replaced this commit before it was built. */
  | { state: "superseded" }
  /** Pages is off, or serves something other than Updater's branch. */
  | { state: "not_serving"; settingsUrl: string };

/** What GitHub Pages reports for the commit Updater wrote. Never "built" for any other commit. */
export async function buildStatus(
  deps: GithubDeps,
  config: ReadyConfig,
  link: SiteLink,
  commitSha: string,
): Promise<Outcome<BuildStatus>> {
  const inspected = await inspectSite(deps, config, link);
  if (!inspected.ok) return inspected;
  if (inspected.value.state !== "ready") return notReady(inspected.value);
  const { site, token } = inspected.value;
  if (site.pages.state !== "serving_updater") return { ok: true, value: { state: "not_serving", settingsUrl: site.settingsUrl } };
  const auth = `Bearer ${token}`;
  const repo = `/repos/${site.repository}`;

  const latest = await githubRequest(deps, { path: `${repo}/pages/builds/latest`, auth });
  if (!latest.ok) return latest;
  if (latest.value.status === 404) return { ok: true, value: { state: "building" } };
  if (latest.value.status !== 200) return unexpected(latest.value.status, "reading the GitHub Pages build");
  const build = buildSchema.safeParse(latest.value.data);
  if (!build.success) return unexpected(latest.value.status, "reading the GitHub Pages build");

  if (build.data.commit === commitSha) {
    if (build.data.status === "built") {
      return { ok: true, value: { state: "built", url: site.pages.url, builtAt: build.data.updated_at ?? deps.now().toISOString() } };
    }
    if (build.data.status === "errored") {
      const message = build.data.error?.message?.trim() || "GitHub Pages couldn't build the site.";
      return { ok: true, value: { state: "errored", message: message.slice(0, 250) } };
    }
    return { ok: true, value: { state: "building" } };
  }

  // The latest build is for another commit: ours is queued, or a newer publish replaced it.
  const ref = await githubRequest(deps, { path: `${repo}/git/ref/heads/${PAGES_BRANCH}`, auth });
  if (!ref.ok) return ref;
  const head = refSchema.safeParse(ref.value.data);
  if (ref.value.status === 200 && head.success && head.data.object.sha !== commitSha) return { ok: true, value: { state: "superseded" } };
  return { ok: true, value: { state: "building" } };
}
