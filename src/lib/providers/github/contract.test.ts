import { describe, expect, it, vi } from "vitest";
import { requestGithubRepositories } from "./contract";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const LISTING = {
  login: "octo-sample",
  repositories: [
    {
      item: {
        externalId: "repo:1",
        kind: "repository",
        title: "kept",
        url: "https://github.com/octo-sample/kept",
        occurredAt: "2026-01-02T03:04:05Z",
        metadata: { owner: "octo-sample", language: "Go" },
      },
      pushedAt: "2026-10-01T00:00:00Z",
    },
  ],
  skipped: { forks: 0, private: 0, invalid: 0 },
  truncated: false,
};

describe("requestGithubRepositories (browser side)", () => {
  it("calls Updater's own server, never GitHub, with the username as a query parameter", async () => {
    const fetch = vi.fn(async () => json({ ok: true, value: LISTING }));
    const outcome = await requestGithubRepositories("octo-sample", fetch);
    expect(outcome).toMatchObject({ ok: true, value: { login: "octo-sample" } });
    expect(fetch).toHaveBeenCalledWith("/api/github/repositories?username=octo-sample", expect.anything());
  });

  it("passes GitHub failures through, and explains a signed-out or unavailable server", async () => {
    const error = { code: "rate_limited", message: "Limit reached.", resetAt: "2026-10-31T11:00:00.000Z" };
    expect(await requestGithubRepositories("x", async () => json({ ok: false, error }, 429))).toEqual({ ok: false, error });
    expect(await requestGithubRepositories("x", async () => json({ error: "Sign in required." }, 401))).toMatchObject({
      ok: false,
      error: { code: "signed_out" },
    });
    expect(await requestGithubRepositories("x", async () => json({ error: "Sign-in isn't configured." }, 503))).toMatchObject({
      ok: false,
      error: { code: "server_unavailable" },
    });
    expect(
      await requestGithubRepositories("x", async () => {
        throw new TypeError("Failed to fetch");
      }),
    ).toMatchObject({ ok: false, error: { code: "server_unavailable" } });
  });

  it("rejects a response that doesn't match the contract instead of trusting it", async () => {
    const unsafe = {
      ok: true,
      value: { ...LISTING, repositories: [{ item: { ...LISTING.repositories[0].item, url: "javascript:alert(1)" } }] },
    };
    for (const body of [unsafe, { ok: true, value: { ...LISTING, login: "" } }, "not json", null]) {
      expect(await requestGithubRepositories("x", async () => json(body))).toMatchObject({
        ok: false,
        error: { code: "bad_response" },
      });
    }
  });
});
