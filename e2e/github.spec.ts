import AxeBuilder from "@axe-core/playwright";
import type { Page, Route } from "@playwright/test";
import { expect, openPage, test } from "./fixtures";

/**
 * GitHub public repository import (T10.1).
 *
 * The first tests call the real route on the `next start` server. They never
 * reach GitHub: the requests are refused before any outbound call (no
 * session, invalid username). The journey test replaces only the browser's
 * call to Updater's own `/api/github/repositories` with a recorded-shape
 * listing, because the test server can't depend on GitHub being reachable;
 * the server-side GitHub client is covered by unit tests
 * (src/lib/providers/github/repositories.test.ts).
 */

const LISTING = {
  ok: true,
  value: {
    login: "octo-sample",
    repositories: [
      {
        item: {
          externalId: "repo:101",
          kind: "repository",
          title: "tidewatch",
          url: "https://github.com/octo-sample/tidewatch",
          occurredAt: "2026-02-03T04:05:06Z",
          metadata: { owner: "octo-sample", description: "Tide table summaries from public CSV files", language: "Go", topics: ["cli"] },
        },
        pushedAt: "2026-10-01T00:00:00Z",
      },
      {
        item: {
          externalId: "repo:102",
          kind: "repository",
          title: "lanterns",
          url: "https://github.com/octo-sample/lanterns",
          occurredAt: "2025-06-07T08:09:10Z",
          metadata: { owner: "octo-sample", language: "TypeScript", archived: true },
        },
      },
    ],
    skipped: { forks: 1, private: 0, invalid: 0 },
    truncated: false,
    rateLimit: { limit: 60, remaining: 58, resetAt: "2026-10-31T11:00:00.000Z" },
  },
};

async function stubListing(page: Page, responses: Array<{ status: number; body: unknown }>) {
  const requested: string[] = [];
  await page.route("**/api/github/repositories?**", async (route: Route) => {
    requested.push(route.request().url());
    const next = responses.shift() ?? { status: 500, body: {} };
    await route.fulfill({ status: next.status, contentType: "application/json", body: JSON.stringify(next.body) });
  });
  return requested;
}

test.describe("the real route", () => {
  test("refuses an invalid username before contacting GitHub", async ({ page }) => {
    await openPage(page, "/sources");
    const response = await page.request.get("/api/github/repositories?username=..%2Fadmin");
    expect(response.status()).toBe(400);
    expect(response.headers()["cache-control"]).toContain("no-store");
    expect(await response.json()).toMatchObject({ ok: false, error: { code: "invalid_username" } });
  });

  test.describe("signed out", () => {
    test.use({ signedIn: false });
    test("requires a session", async ({ request }) => {
      const response = await request.get("/api/github/repositories?username=octo-sample");
      expect(response.status()).toBe(401);
      expect(JSON.stringify(await response.json())).not.toContain("repositories");
    });
  });
});

test("Journey B: import chosen GitHub repositories, review them, and keep them after reload", async ({ page }) => {
  const requested = await stubListing(page, [{ status: 200, body: LISTING }]);
  await openPage(page, "/sources");
  const card = page.getByRole("region", { name: "GitHub" });
  await expect(card.getByText("Not set up", { exact: true })).toBeVisible();
  await card.getByRole("button", { name: "Import repositories" }).click();

  const dialog = page.getByRole("dialog", { name: "Import from GitHub" });
  await dialog.getByRole("textbox", { name: /GitHub username/ }).fill("octo-sample");
  await dialog.getByRole("button", { name: "Find repositories" }).click();
  await expect(dialog.getByText("Found 2 public repositories owned by @octo-sample.")).toBeVisible();
  expect(new URL(requested[0]).searchParams.get("username")).toBe("octo-sample");

  // Accessible with the listing open.
  const results = await new AxeBuilder({ page }).include('[role="dialog"]').withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(results.violations.map((violation) => violation.id)).toEqual([]);

  await dialog.getByRole("checkbox", { name: "tidewatch" }).click();
  await dialog.getByRole("button", { name: "Import 1 repository" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("region", { name: /Notifications/ }).getByText("Imported 1 repository")).toBeVisible();
  await expect(card.getByText("Public import", { exact: true })).toBeVisible();
  await expect(page.getByRole("main")).not.toContainText(/\bConnected\b/);

  await card.getByRole("button", { name: /Show 1 item/ }).click();
  const link = card.getByRole("link", { name: /Open source/ });
  await expect(link).toHaveAttribute("href", "https://github.com/octo-sample/tidewatch");
  await expect(link).toHaveAttribute("rel", "noopener noreferrer");

  await openPage(page, "/review");
  await page.getByRole("button", { name: /^Approve “Tide table summaries/ }).click();
  await openPage(page, "/portfolio");
  await expect(page.getByRole("main")).toContainText("tidewatch");

  await page.reload();
  await openPage(page, "/sources");
  await expect(page.getByRole("region", { name: "GitHub" }).getByText(/Importing public data for/)).toContainText("@octo-sample");
});

test.describe("a failed check", () => {
  // The browser logs the deliberate 504 from the stubbed route.
  test.use({ allowedConsoleErrors: [/status of 504/] });
  test("is shown and recorded on the source, and imported data stays", async ({ page }) => {
    await stubListing(page, [
      { status: 200, body: LISTING },
      {
        status: 504,
        body: { ok: false, error: { code: "unreachable", message: "Updater's server couldn't reach GitHub. Try again in a moment." } },
      },
    ]);
    await openPage(page, "/sources");
    const card = page.getByRole("region", { name: "GitHub" });
    await card.getByRole("button", { name: "Import repositories" }).click();
    const dialog = page.getByRole("dialog", { name: "Import from GitHub" });
    await dialog.getByRole("textbox", { name: /GitHub username/ }).fill("octo-sample");
    await dialog.getByRole("button", { name: "Find repositories" }).click();
    await dialog.getByRole("button", { name: "Select all new" }).click();
    await dialog.getByRole("button", { name: "Import 2 repositories" }).click();
    await expect(dialog).toBeHidden();

    await card.getByRole("button", { name: "Check for updates" }).click();
    const check = page.getByRole("dialog", { name: "Check @octo-sample for updates" });
    await expect(check.getByRole("alert")).toContainText("couldn't reach GitHub");
    await check.getByRole("button", { name: "Cancel" }).click();
    await expect(card.getByText("Needs attention", { exact: true })).toBeVisible();
    await expect(card.getByText("The last check failed")).toBeVisible();
    await expect(card.getByRole("button", { name: /Show 2 items/ })).toBeVisible();
  });
});
