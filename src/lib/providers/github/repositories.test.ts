import { describe, expect, it, vi } from "vitest";
import { githubRepo, githubResponse, RECORDED_REPOSITORY } from "@/test/github";
import { githubResponseSchema } from "./contract";
import {
  fetchPublicRepositories,
  MAX_PAGES,
  parseGithubUsername,
  rateLimitResetAt,
  repositoriesResponse,
} from "./repositories";

const NOW = new Date("2026-10-31T10:00:00.000Z");

function fetchReturning(...responses: Array<Response | Error>) {
  const queue = [...responses];
  return vi.fn(async (input: string, init: RequestInit) => {
    void input;
    void init;
    const next = queue.shift();
    if (!next) throw new Error("Unexpected extra request");
    if (next instanceof Error) throw next;
    return next;
  });
}

describe("GitHub username validation", () => {
  it("accepts GitHub's username rules, with an optional leading @", () => {
    expect(parseGithubUsername("octo-sample")).toEqual({ ok: true, username: "octo-sample" });
    expect(parseGithubUsername("  @Octo42 ")).toEqual({ ok: true, username: "Octo42" });
    expect(parseGithubUsername("a".repeat(39)).ok).toBe(true);
  });

  it("rejects anything that could change the request path or query", () => {
    for (const bad of ["", "-lead", "trail-", "dou--ble", "a".repeat(40), "a/b", "../users", "a?b=c", "a#b", "a b", "ünï", "a%2Fb"]) {
      expect(parseGithubUsername(bad).ok, bad).toBe(false);
    }
  });
});

describe("fetchPublicRepositories (T10.1)", () => {
  it("requests the fixed public endpoint with GitHub's headers and no token by default", async () => {
    const fetch = fetchReturning(githubResponse([]));
    await fetchPublicRepositories("octo-sample", { fetch, now: () => NOW });
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe(
      "https://api.github.com/users/octo-sample/repos?type=owner&sort=pushed&direction=desc&per_page=100&page=1",
    );
    const headers = init.headers as Record<string, string>;
    expect(headers).toMatchObject({ Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" });
    expect(headers.Authorization).toBeUndefined();
    expect(init.redirect).toBe("error");
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("sends the optional server token as a bearer token", async () => {
    const fetch = fetchReturning(githubResponse([]));
    await fetchPublicRepositories("octo-sample", { fetch, token: " ghp_example ", now: () => NOW });
    expect((fetch.mock.calls[0][1].headers as Record<string, string>).Authorization).toBe("Bearer ghp_example");
  });

  it("never sends a request for an invalid username", async () => {
    const fetch = fetchReturning();
    const result = await fetchPublicRepositories("a/../b", { fetch });
    expect(result).toMatchObject({ ok: false, error: { code: "invalid_username" } });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("normalizes a recorded real repository into a raw source item", async () => {
    const fetch = fetchReturning(githubResponse([RECORDED_REPOSITORY]));
    const result = await fetchPublicRepositories("tanay9098", { fetch, now: () => NOW });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.login).toBe("tanay9098");
    expect(result.value.repositories).toEqual([
      {
        item: {
          externalId: "repo:1436669665",
          kind: "repository",
          title: "Updater",
          url: "https://github.com/tanay9098/Updater",
          occurredAt: "2026-10-28T06:02:24Z",
          // No description, topics, or license were reported, so none are invented.
          metadata: { owner: "tanay9098", language: "TypeScript" },
        },
        pushedAt: "2026-10-31T08:21:33Z",
      },
    ]);
    expect(result.value.rateLimit).toEqual({ limit: 60, remaining: 57, resetAt: "2026-10-31T09:32:52.000Z" });
  });

  it("keeps description, topics, license, and archived state; drops forks, private repositories, and unknown fields", async () => {
    const fetch = fetchReturning(
      githubResponse([
        githubRepo({ name: "kept", archived: true, topics: ["cli", "csv"], stargazers_count: 99 }),
        githubRepo({ name: "a-fork", fork: true }),
        githubRepo({ name: "secret", private: true }),
        githubRepo({ name: "no-license", license: { spdx_id: "NOASSERTION" } }),
        { id: "not-a-number", name: "broken" },
        githubRepo({ name: "elsewhere", html_url: "https://evil.example/octo-sample/elsewhere" }),
        githubRepo({ name: "scripted", html_url: "javascript:alert(1)" }),
      ]),
    );
    const result = await fetchPublicRepositories("octo-sample", { fetch, now: () => NOW });
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.repositories.map((candidate) => candidate.item.title)).toEqual(["kept", "no-license"]);
    expect(result.value.repositories[0].item.metadata).toEqual({
      owner: "octo-sample",
      description: "Sample repository description",
      language: "Go",
      topics: ["cli", "csv"],
      license: "MIT",
      archived: true,
    });
    expect(result.value.repositories[1].item.metadata).not.toHaveProperty("license");
    expect(JSON.stringify(result.value)).not.toContain("stargazers");
    expect(result.value.skipped).toEqual({ forks: 1, private: 1, invalid: 3 });
  });

  it("pages with rel=next up to the cap and reports truncation, without following the header's URL", async () => {
    const page = () => Array.from({ length: 100 }, () => githubRepo());
    const next = { link: '<https://evil.example/steal?page=2>; rel="next", <https://api.github.com/x?page=9>; rel="last"' };
    const fetch = fetchReturning(
      githubResponse(page(), { headers: next }),
      githubResponse(page(), { headers: next }),
      githubResponse(page(), { headers: next }),
    );
    const result = await fetchPublicRepositories("octo-sample", { fetch, now: () => NOW });
    expect(fetch).toHaveBeenCalledTimes(MAX_PAGES);
    expect(fetch.mock.calls.map(([url]) => new URL(url).searchParams.get("page"))).toEqual(["1", "2", "3"]);
    for (const [url] of fetch.mock.calls) expect(new URL(url).origin).toBe("https://api.github.com");
    expect(result).toMatchObject({ ok: true, value: { truncated: true } });
    if (result.ok) expect(result.value.repositories).toHaveLength(300);
  });

  it("stops after the last page", async () => {
    const fetch = fetchReturning(
      githubResponse([githubRepo()], { headers: { link: '<https://api.github.com/x?page=2>; rel="next"' } }),
      githubResponse([githubRepo()], { headers: { link: '<https://api.github.com/x?page=1>; rel="prev"' } }),
    );
    const result = await fetchPublicRepositories("octo-sample", { fetch, now: () => NOW });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ ok: true, value: { truncated: false } });
  });

  it("reports an unknown account", async () => {
    const fetch = fetchReturning(githubResponse({ message: "Not Found" }, { status: 404 }));
    const result = await fetchPublicRepositories("nobody-here", { fetch, now: () => NOW });
    expect(result).toEqual({
      ok: false,
      error: { code: "not_found", message: "GitHub has no user or organization named “nobody-here”." },
    });
  });

  it("reports the primary rate limit with GitHub's reset time", async () => {
    const fetch = fetchReturning(
      githubResponse({ message: "API rate limit exceeded" }, { status: 403, headers: { "x-ratelimit-remaining": "0" } }),
    );
    const result = await fetchPublicRepositories("octo-sample", { fetch, now: () => NOW });
    expect(result).toEqual({
      ok: false,
      error: { code: "rate_limited", message: expect.any(String), resetAt: "2026-10-31T09:32:52.000Z" },
    });
  });

  it("reports a secondary rate limit from retry-after", async () => {
    const response = githubResponse({}, { status: 429, headers: { "retry-after": "120" } });
    expect(rateLimitResetAt(response, NOW)).toBe("2026-10-31T10:02:00.000Z");
    // A 403 that isn't a rate limit (remaining > 0, no retry-after) is a plain error.
    expect(rateLimitResetAt(githubResponse({}, { status: 403 }), NOW)).toBeUndefined();
  });

  it("maps other failures to readable errors", async () => {
    const cases: Array<[Response | Error, string]> = [
      [githubResponse({ message: "Bad credentials" }, { status: 401 }), "token_rejected"],
      [githubResponse({}, { status: 500 }), "provider_error"],
      [githubResponse({}, { status: 403 }), "provider_error"],
      [githubResponse("<html>not json</html>"), "provider_error"],
      [githubResponse({ message: "an object, not a list" }), "provider_error"],
      [new TypeError("fetch failed"), "unreachable"],
      [Object.assign(new Error("timed out"), { name: "TimeoutError" }), "unreachable"],
    ];
    for (const [response, code] of cases) {
      const result = await fetchPublicRepositories("octo-sample", { fetch: fetchReturning(response), now: () => NOW });
      expect(result, code).toMatchObject({ ok: false, error: { code } });
    }
  });

  it("never puts the token in a result", async () => {
    const result = await fetchPublicRepositories("octo-sample", {
      fetch: fetchReturning(githubResponse({ message: "Bad credentials" }, { status: 401 })),
      token: "ghp_secret_value",
      now: () => NOW,
    });
    expect(JSON.stringify(result)).not.toContain("ghp_secret_value");
  });
});

describe("repositoriesResponse (route body)", () => {
  it("answers with a status per outcome and a body the browser schema accepts", async () => {
    const success = await repositoriesResponse(new URLSearchParams({ username: "octo-sample" }), {
      fetch: fetchReturning(githubResponse([githubRepo()])),
      now: () => NOW,
    });
    expect(success.status).toBe(200);
    expect(githubResponseSchema.safeParse(success.body).success).toBe(true);

    const cases: Array<[URLSearchParams, Response | null, number]> = [
      [new URLSearchParams(), null, 400],
      [new URLSearchParams({ username: "../x" }), null, 400],
      [new URLSearchParams({ username: "nobody" }), githubResponse({}, { status: 404 }), 404],
      [new URLSearchParams({ username: "busy" }), githubResponse({}, { status: 429 }), 429],
      [new URLSearchParams({ username: "broken" }), githubResponse({}, { status: 502 }), 502],
    ];
    for (const [params, response, status] of cases) {
      const outcome = await repositoriesResponse(params, {
        fetch: response ? fetchReturning(response) : fetchReturning(),
        now: () => NOW,
      });
      expect(outcome.status).toBe(status);
      expect(githubResponseSchema.safeParse(outcome.body).success).toBe(true);
    }
  });
});
