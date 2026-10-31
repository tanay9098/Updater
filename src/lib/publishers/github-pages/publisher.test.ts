import { createHash, createPublicKey } from "node:crypto";
import { jwtVerify } from "jose";
import { beforeAll, describe, expect, it } from "vitest";
import type { PublicPortfolio } from "@/lib/validation/publication";
import { SHA_A, SHA_B, SHA_C, githubResponse, testPrivateKey } from "@/test/publishing";
import type { GithubDeps } from "./github-api";
import { buildStatusAnswer, publishAnswer, siteAnswer } from "./handlers";
import { createAuthorizationRequest, verifyGithubAccount } from "./link";
import { COMMIT_MESSAGE, buildStatus, inspectSite, publishSite, type ReadyConfig } from "./publisher";
import { MARKER_FILE, SITE_FILES } from "./render";

const API = "https://api.github.com";
const REPO = "/repos/octo-sample/octo-sample.github.io";
const LINK = { githubUserId: 42, login: "octo-sample" };
const NOW = new Date("2026-10-31T10:00:00.000Z");
const PORTFOLIO: PublicPortfolio = {
  profile: { name: "Sam Rivera", headline: "Developer", intro: "", links: [] },
  skills: ["TypeScript"],
  projects: [],
  achievements: [],
};

let config: ReadyConfig;
beforeAll(async () => {
  config = {
    state: "ready",
    appId: "123456",
    slug: "updater-test",
    clientId: "Iv23liTest",
    clientSecret: "test-client-secret",
    privateKey: await testPrivateKey(),
  };
});

type Call = { method: string; url: string; auth?: string; body?: unknown };
type Route = (call: Call) => Response;

/** A fake GitHub API: answers keyed by "METHOD url-without-origin". Unknown requests fail the test. */
function fakeGithub(routes: Record<string, Route | Response>) {
  const calls: Call[] = [];
  const deps: GithubDeps = {
    now: () => NOW,
    fetch: async (input, init) => {
      const url = input;
      const headers = new Headers(init.headers);
      const call: Call = {
        method: init.method ?? "GET",
        url,
        auth: headers.get("authorization") ?? undefined,
        body: init.body ? JSON.parse(String(init.body)) : undefined,
      };
      calls.push(call);
      expect(init.redirect).toBe("error");
      const key = `${call.method} ${url.replace(API, "")}`;
      const route = routes[key];
      if (!route) throw new Error(`Unexpected GitHub request: ${key}`);
      return typeof route === "function" ? route(call) : route.clone();
    },
  };
  return { deps, calls };
}

const READY_ROUTES: Record<string, Route | Response> = {
  "GET /users/octo-sample/installation": githubResponse(200, { id: 7, account: { id: 42, login: "octo-sample" } }),
  "POST /app/installations/7/access_tokens": githubResponse(201, { token: "ghs_test_token", expires_at: "2026-10-31T11:00:00Z" }),
  [`GET ${REPO}`]: githubResponse(200, {
    full_name: "octo-sample/octo-sample.github.io",
    name: "octo-sample.github.io",
    private: false,
    owner: { id: 42, login: "octo-sample" },
  }),
  [`GET ${REPO}/pages`]: githubResponse(404, { message: "Not Found" }),
};

const SERVING_UPDATER = githubResponse(200, {
  html_url: "https://octo-sample.github.io/",
  build_type: "legacy",
  source: { branch: "gh-pages", path: "/" },
});

const NEW_BRANCH_ROUTES: Record<string, Route | Response> = {
  ...READY_ROUTES,
  [`GET ${REPO}/git/ref/heads/gh-pages`]: githubResponse(404, { message: "Not Found" }),
  [`POST ${REPO}/git/trees`]: githubResponse(201, { sha: SHA_A }),
  [`POST ${REPO}/git/commits`]: githubResponse(201, { sha: SHA_B }),
  [`POST ${REPO}/git/refs`]: githubResponse(201, { ref: "refs/heads/gh-pages", object: { sha: SHA_B } }),
  [`POST ${REPO}/pages`]: githubResponse(201, { html_url: "https://octo-sample.github.io/" }),
};

/** gh-pages exists at SHA_C; `marker` decides whether Updater wrote it. */
function existingBranch(marker: boolean): Record<string, Route | Response> {
  return {
    [`GET ${REPO}/git/ref/heads/gh-pages`]: githubResponse(200, { object: { sha: SHA_C } }),
    [`GET ${REPO}/git/commits/${SHA_C}`]: githubResponse(200, { sha: SHA_C, tree: { sha: "d".repeat(40) } }),
    [`GET ${REPO}/git/trees/${"d".repeat(40)}`]: githubResponse(200, {
      sha: "d".repeat(40),
      tree: [{ path: "index.html" }, ...(marker ? [{ path: MARKER_FILE }] : [])],
    }),
  };
}

const writes = (calls: Call[]) => calls.filter((call) => call.method !== "GET");

describe("inspectSite (T10.9)", () => {
  it("authenticates as the app with a valid RS256 token, then mints a token for the one repository", async () => {
    const { deps, calls } = fakeGithub(READY_ROUTES);
    const outcome = await inspectSite(deps, config, LINK);
    expect(outcome).toMatchObject({ ok: true, value: { state: "ready", site: { pages: { state: "not_enabled" } } } });

    const jwt = calls[0].auth!.replace("Bearer ", "");
    const { payload, protectedHeader } = await jwtVerify(jwt, createPublicKey(config.privateKey), { currentDate: NOW });
    expect(protectedHeader.alg).toBe("RS256");
    expect(payload.iss).toBe("123456");
    expect(payload.exp! - payload.iat!).toBeLessThanOrEqual(600);

    expect(calls[1].body).toEqual({
      repositories: ["octo-sample.github.io"],
      permissions: { contents: "write", pages: "write", metadata: "read" },
    });
    expect(calls[2].auth).toBe("Bearer ghs_test_token");
  });

  it("reports the app as not installed, also when the login now belongs to another account", async () => {
    const missing = fakeGithub({ "GET /users/octo-sample/installation": githubResponse(404, {}) });
    expect(await inspectSite(missing.deps, config, LINK)).toMatchObject({ ok: true, value: { state: "not_installed" } });
    const other = fakeGithub({ "GET /users/octo-sample/installation": githubResponse(200, { id: 7, account: { id: 99, login: "octo-sample" } }) });
    expect(await inspectSite(other.deps, config, LINK)).toMatchObject({ ok: true, value: { state: "not_installed" } });
    expect(other.calls).toHaveLength(1);
  });

  it("reports the repository as missing when the installation can't reach it", async () => {
    const { deps } = fakeGithub({
      ...READY_ROUTES,
      "POST /app/installations/7/access_tokens": githubResponse(422, { message: "not accessible" }),
    });
    expect(await inspectSite(deps, config, LINK)).toMatchObject({
      ok: true,
      value: {
        state: "repository_missing",
        repository: "octo-sample/octo-sample.github.io",
        createUrl: "https://github.com/new?name=octo-sample.github.io&visibility=public",
      },
    });
  });

  it("describes what Pages serves when it isn't Updater's branch", async () => {
    const { deps } = fakeGithub({
      ...READY_ROUTES,
      [`GET ${REPO}/pages`]: githubResponse(200, { html_url: "https://octo-sample.github.io/", build_type: "legacy", source: { branch: "main", path: "/" } }),
    });
    expect(await inspectSite(deps, config, LINK)).toMatchObject({
      ok: true,
      value: { state: "ready", site: { pages: { state: "serving_other", source: "the main branch, / folder" } } },
    });
  });

  it("returns GitHub's rate limit with the reset time", async () => {
    const { deps } = fakeGithub({
      "GET /users/octo-sample/installation": githubResponse(403, {}, { "x-ratelimit-remaining": "0", "x-ratelimit-limit": "5000", "x-ratelimit-reset": "1793440800" }),
    });
    expect(await inspectSite(deps, config, LINK)).toMatchObject({ ok: false, error: { code: "rate_limited", resetAt: new Date(1793440800 * 1000).toISOString() } });
  });
});

describe("publishSite (T10.9)", () => {
  it("commits the site as a new gh-pages branch and turns on Pages for it", async () => {
    const { deps, calls } = fakeGithub(NEW_BRANCH_ROUTES);
    const outcome = await publishSite(deps, config, LINK, PORTFOLIO, {});
    expect(outcome).toEqual({
      ok: true,
      value: {
        repository: "octo-sample/octo-sample.github.io",
        commitSha: SHA_B,
        siteUrl: "https://octo-sample.github.io/",
        settingsUrl: "https://github.com/octo-sample/octo-sample.github.io/settings/pages",
        pagesSetup: "ready",
      },
    });

    const tree = calls.find((call) => call.url.endsWith("/git/trees"))!.body as { tree: { path: string; mode: string }[] };
    expect(tree.tree.map((entry) => entry.path)).toEqual([...SITE_FILES]);
    expect(tree.tree.every((entry) => entry.mode === "100644")).toBe(true);
    expect(calls.find((call) => call.url.endsWith("/git/commits"))!.body).toEqual({ message: COMMIT_MESSAGE, tree: SHA_A, parents: [] });
    expect(calls.find((call) => call.url.endsWith("/git/refs"))!.body).toEqual({ ref: "refs/heads/gh-pages", sha: SHA_B });
    expect(calls.find((call) => call.method === "POST" && call.url.endsWith("/pages"))!.body).toEqual({
      build_type: "legacy",
      source: { branch: "gh-pages", path: "/" },
    });
  });

  it("writes only to the developer's site repository", async () => {
    const { deps, calls } = fakeGithub(NEW_BRANCH_ROUTES);
    await publishSite(deps, config, LINK, PORTFOLIO, {});
    const repositoryWrites = writes(calls).filter((call) => !call.url.includes("/access_tokens"));
    expect(repositoryWrites.length).toBeGreaterThan(0);
    expect(repositoryWrites.every((call) => call.url.startsWith(`${API}${REPO}/`))).toBe(true);
  });

  it("refuses to replace a gh-pages branch Updater didn't write, without writing anything", async () => {
    const { deps, calls } = fakeGithub({ ...NEW_BRANCH_ROUTES, ...existingBranch(false) });
    const outcome = await publishSite(deps, config, LINK, PORTFOLIO, {});
    expect(outcome).toMatchObject({ ok: false, error: { code: "branch_in_use" } });
    expect(writes(calls).filter((call) => !call.url.includes("/access_tokens"))).toEqual([]);
  });

  it("replaces that branch once confirmed, keeping its history as the parent", async () => {
    const { deps, calls } = fakeGithub({
      ...NEW_BRANCH_ROUTES,
      ...existingBranch(false),
      [`PATCH ${REPO}/git/refs/heads/gh-pages`]: githubResponse(200, { object: { sha: SHA_B } }),
    });
    expect((await publishSite(deps, config, LINK, PORTFOLIO, { replaceBranch: true })).ok).toBe(true);
    expect(calls.find((call) => call.url.endsWith("/git/commits"))!.body).toMatchObject({ parents: [SHA_C] });
    expect(calls.find((call) => call.method === "PATCH")!.body).toEqual({ sha: SHA_B, force: false });
  });

  it("updates its own branch without asking", async () => {
    const { deps } = fakeGithub({
      ...NEW_BRANCH_ROUTES,
      ...existingBranch(true),
      [`GET ${REPO}/pages`]: SERVING_UPDATER,
      [`PATCH ${REPO}/git/refs/heads/gh-pages`]: githubResponse(200, { object: { sha: SHA_B } }),
    });
    expect(await publishSite(deps, config, LINK, PORTFOLIO, {})).toMatchObject({ ok: true, value: { pagesSetup: "ready" } });
  });

  it("asks before switching what Pages serves, then switches with PUT", async () => {
    const routes = {
      ...NEW_BRANCH_ROUTES,
      [`GET ${REPO}/pages`]: githubResponse(200, { html_url: "https://octo-sample.github.io/", build_type: "workflow", source: null }),
      [`PUT ${REPO}/pages`]: githubResponse(204),
    };
    const refused = fakeGithub(routes);
    expect(await publishSite(refused.deps, config, LINK, PORTFOLIO, {})).toMatchObject({
      ok: false,
      error: { code: "pages_source_conflict", currentSource: "a GitHub Actions workflow" },
    });
    expect(writes(refused.calls).filter((call) => !call.url.includes("/access_tokens"))).toEqual([]);

    const confirmed = fakeGithub(routes);
    expect(await publishSite(confirmed.deps, config, LINK, PORTFOLIO, { switchPagesSource: true })).toMatchObject({ ok: true });
    expect(confirmed.calls.some((call) => call.method === "PUT" && call.url.endsWith("/pages"))).toBe(true);
  });

  it("reports a manual step when GitHub won't let the app turn Pages on", async () => {
    const { deps } = fakeGithub({ ...NEW_BRANCH_ROUTES, [`POST ${REPO}/pages`]: githubResponse(403, { message: "Resource not accessible by integration" }) });
    expect(await publishSite(deps, config, LINK, PORTFOLIO, {})).toMatchObject({ ok: true, value: { pagesSetup: "manual" } });
  });

  it("explains an empty repository", async () => {
    const { deps } = fakeGithub({ ...NEW_BRANCH_ROUTES, [`GET ${REPO}/git/ref/heads/gh-pages`]: githubResponse(409, { message: "Git Repository is empty." }) });
    expect(await publishSite(deps, config, LINK, PORTFOLIO, {})).toMatchObject({ ok: false, error: { code: "repository_empty" } });
  });

  it("never forces the branch: a concurrent change is reported", async () => {
    const { deps } = fakeGithub({
      ...NEW_BRANCH_ROUTES,
      ...existingBranch(true),
      [`GET ${REPO}/pages`]: SERVING_UPDATER,
      [`PATCH ${REPO}/git/refs/heads/gh-pages`]: githubResponse(422, { message: "Update is not a fast forward" }),
    });
    expect(await publishSite(deps, config, LINK, PORTFOLIO, {})).toMatchObject({ ok: false, error: { code: "branch_changed" } });
  });

  it("reports a network failure as unreachable", async () => {
    const deps: GithubDeps = {
      now: () => NOW,
      fetch: async () => {
        throw new TypeError("fetch failed");
      },
    };
    expect(await publishSite(deps, config, LINK, PORTFOLIO, {})).toMatchObject({ ok: false, error: { code: "unreachable" } });
  });
});

describe("buildStatus (T10.9)", () => {
  const serving = { ...READY_ROUTES, [`GET ${REPO}/pages`]: SERVING_UPDATER };

  it("is built only for the commit Updater wrote, with GitHub's address and time", async () => {
    const { deps } = fakeGithub({
      ...serving,
      [`GET ${REPO}/pages/builds/latest`]: githubResponse(200, { status: "built", commit: SHA_B, updated_at: "2026-10-31T10:01:00Z" }),
    });
    expect(await buildStatus(deps, config, LINK, SHA_B)).toEqual({
      ok: true,
      value: { state: "built", url: "https://octo-sample.github.io/", builtAt: "2026-10-31T10:01:00Z" },
    });
  });

  it("passes on GitHub's build error", async () => {
    const { deps } = fakeGithub({
      ...serving,
      [`GET ${REPO}/pages/builds/latest`]: githubResponse(200, { status: "errored", commit: SHA_B, error: { message: "Page build failed." } }),
    });
    expect(await buildStatus(deps, config, LINK, SHA_B)).toEqual({ ok: true, value: { state: "errored", message: "Page build failed." } });
  });

  it("waits while another commit's build is the latest and the branch still points at ours", async () => {
    const { deps } = fakeGithub({
      ...serving,
      [`GET ${REPO}/pages/builds/latest`]: githubResponse(200, { status: "built", commit: SHA_A }),
      [`GET ${REPO}/git/ref/heads/gh-pages`]: githubResponse(200, { object: { sha: SHA_B } }),
    });
    expect(await buildStatus(deps, config, LINK, SHA_B)).toEqual({ ok: true, value: { state: "building" } });
  });

  it("reports a superseded commit when the branch moved on", async () => {
    const { deps } = fakeGithub({
      ...serving,
      [`GET ${REPO}/pages/builds/latest`]: githubResponse(200, { status: "built", commit: SHA_C }),
      [`GET ${REPO}/git/ref/heads/gh-pages`]: githubResponse(200, { object: { sha: SHA_C } }),
    });
    expect(await buildStatus(deps, config, LINK, SHA_B)).toEqual({ ok: true, value: { state: "superseded" } });
  });

  it("says Pages isn't serving the branch instead of claiming anything", async () => {
    const { deps } = fakeGithub(READY_ROUTES);
    expect(await buildStatus(deps, config, LINK, SHA_B)).toMatchObject({ ok: true, value: { state: "not_serving" } });
  });
});

describe("route answers (T10.9)", () => {
  it("say publishing is unavailable when the server has no GitHub App", async () => {
    const deps = { now: () => NOW, fetch: async () => githubResponse(500), config: { state: "missing" as const, missing: [] } };
    expect(await siteAnswer(deps, LINK)).toEqual({ status: 200, body: { state: "unavailable" } });
    expect(await publishAnswer(deps, LINK, {})).toMatchObject({ status: 503, body: { ok: false, error: { code: "not_configured" } } });
    expect(await buildStatusAnswer(deps, LINK, SHA_A)).toMatchObject({ status: 503 });
  });

  it("refuse without a linked GitHub account, an invalid body, or an invalid commit", async () => {
    const { deps: github } = fakeGithub(NEW_BRANCH_ROUTES);
    const deps = { ...github, config };
    expect(await siteAnswer(deps, null)).toEqual({ status: 200, body: { state: "not_linked" } });
    expect(await publishAnswer(deps, null, { portfolio: PORTFOLIO })).toMatchObject({ status: 409, body: { error: { code: "not_linked" } } });
    expect(await publishAnswer(deps, LINK, { portfolio: { ...PORTFOLIO, token: "x" } })).toMatchObject({ status: 400 });
    expect(await publishAnswer(deps, LINK, { portfolio: { ...PORTFOLIO, profile: { ...PORTFOLIO.profile, links: [{ label: "x", url: "javascript:alert(1)" }] } } })).toMatchObject({ status: 400 });
    expect(await buildStatusAnswer(deps, LINK, "../../x")).toMatchObject({ status: 400 });
  });

  it("never sends the installation token to the browser", async () => {
    const { deps: github } = fakeGithub(READY_ROUTES);
    const answer = await siteAnswer({ ...github, config }, LINK);
    expect(JSON.stringify(answer.body)).not.toContain("ghs_test_token");
    expect(answer.body).toMatchObject({ state: "ready" });
  });

  it("publish answers with the commit for a valid request", async () => {
    const { deps: github } = fakeGithub(NEW_BRANCH_ROUTES);
    expect(await publishAnswer({ ...github, config }, LINK, { portfolio: PORTFOLIO })).toMatchObject({
      status: 200,
      body: { ok: true, value: { commitSha: SHA_B } },
    });
  });
});

describe("linking a GitHub account (T10.9)", () => {
  it("asks GitHub for authorization with state and an S256 PKCE challenge", () => {
    const request = createAuthorizationRequest(config, "https://updater.example/api/github/app/callback");
    const url = new URL(request.url);
    expect(url.origin + url.pathname).toBe("https://github.com/login/oauth/authorize");
    expect(url.searchParams.get("client_id")).toBe("Iv23liTest");
    expect(url.searchParams.get("state")).toBe(request.state);
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).toBe(createHash("sha256").update(request.codeVerifier).digest("base64url"));
    expect(request.state).not.toBe(createAuthorizationRequest(config, "x").state);
  });

  it("learns the GitHub account, then revokes the one-time token", async () => {
    const { deps, calls } = fakeGithub({
      "POST https://github.com/login/oauth/access_token": githubResponse(200, { access_token: "ghu_once", token_type: "bearer" }),
      "GET /user": githubResponse(200, { id: 42, login: "octo-sample" }),
      "DELETE /applications/Iv23liTest/token": githubResponse(204),
    });
    const outcome = await verifyGithubAccount(deps, config, { code: "abc", codeVerifier: "v".repeat(43), redirectUri: "https://updater.example/cb" });
    expect(outcome).toEqual({ ok: true, value: { githubUserId: 42, login: "octo-sample" } });
    expect(calls[0].body).toMatchObject({ client_id: "Iv23liTest", code: "abc", code_verifier: "v".repeat(43) });
    expect(calls[1].auth).toBe("Bearer ghu_once");
    expect(calls[2]).toMatchObject({ method: "DELETE", body: { access_token: "ghu_once" } });
  });

  it("refuses when GitHub doesn't confirm the code", async () => {
    const { deps } = fakeGithub({
      "POST https://github.com/login/oauth/access_token": githubResponse(200, { error: "bad_verification_code" }),
    });
    expect(await verifyGithubAccount(deps, config, { code: "abc", codeVerifier: "v".repeat(43), redirectUri: "x" })).toMatchObject({
      ok: false,
      error: { code: "authorization_failed" },
    });
  });
});
