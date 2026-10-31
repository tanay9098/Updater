import { vi } from "vitest";
import type { SiteResponseBody } from "@/lib/publishers/github-pages/contract";

/**
 * Test helpers for publishing (T10.9): a stand-in for Updater's own
 * publishing routes in component tests, and recorded-shape GitHub answers
 * for the server-side publisher's unit tests. Nothing here reaches GitHub.
 */

export const SHA_A = "a".repeat(40);
export const SHA_B = "b".repeat(40);
export const SHA_C = "c".repeat(40);

export const READY_SITE: SiteResponseBody = {
  state: "ready",
  site: {
    login: "octo-sample",
    repository: "octo-sample/octo-sample.github.io",
    private: false,
    siteUrl: "https://octo-sample.github.io/",
    settingsUrl: "https://github.com/octo-sample/octo-sample.github.io/settings/pages",
    pages: { state: "serving_updater", url: "https://octo-sample.github.io/" },
  },
};

type Answer = { status?: number; body: unknown };
type Handler = Answer | ((init: RequestInit, url: string) => Answer);

/**
 * Replaces `fetch` in the browser with answers keyed by "METHOD /path".
 * Unknown requests fail loudly. Returns the mock so tests can read the calls.
 */
export function stubUpdaterRoutes(handlers: Record<string, Handler>) {
  const mock = vi.fn(async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = String(input);
    const key = `${init.method ?? "GET"} ${url.split("?")[0]}`;
    const handler = handlers[key];
    if (!handler) throw new Error(`Unexpected request in test: ${key}`);
    const answer = typeof handler === "function" ? handler(init, url) : handler;
    return new Response(JSON.stringify(answer.body), {
      status: answer.status ?? 200,
      headers: { "Content-Type": "application/json" },
    });
  });
  vi.stubGlobal("fetch", mock);
  return mock;
}

/** A GitHub API response for the publisher's injected `fetch`. */
export function githubResponse(status: number, body?: unknown, headers: Record<string, string> = {}): Response {
  return new Response(status === 204 || body === undefined ? null : JSON.stringify(body), { status, headers });
}

/** A test-only RSA key, generated per test run. Never a real GitHub App key. */
export async function testPrivateKey(): Promise<string> {
  const { generateKeyPairSync } = await import("node:crypto");
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  return privateKey.export({ type: "pkcs1", format: "pem" }).toString();
}
