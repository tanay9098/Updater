import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { E2E_PORT } from "./env";
import { expect, openPage, test } from "./fixtures";

/**
 * Publishing to the developer's own GitHub Pages site (T10.9).
 *
 * The test server has no GitHub App configured, so the real routes are
 * checked for what they answer without one: publishing is unavailable and
 * nothing reaches GitHub. The journey test replaces only the browser's
 * calls to Updater's own publishing routes with recorded-shape answers,
 * because the test server can't depend on GitHub; the server-side
 * publisher is covered by unit tests against a fake GitHub API
 * (src/lib/publishers/github-pages/publisher.test.ts).
 */

const ORIGIN = `http://localhost:${E2E_PORT}`;
const SHA = "b".repeat(40);
const READY_SITE = {
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
const PORTFOLIO = { profile: { name: "Test Developer", headline: "", intro: "", links: [] }, skills: [], projects: [], achievements: [] };

async function saveName(page: Page, name: string) {
  await page.getByRole("textbox", { name: "Name (required)" }).fill(name);
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByRole("region", { name: /Notifications/ }).getByText("Profile saved")).toBeVisible();
}

test.describe("the real routes on a server without a GitHub App", () => {
  test("say publishing isn't set up, and Publish stays disabled with that reason", async ({ page }) => {
    await openPage(page, "/portfolio");
    const publish = page.getByRole("button", { name: "Publish" });
    await expect(publish).toBeDisabled();
    await expect(publish).toHaveAccessibleDescription(/Publishing isn't set up on this server/);
    await expect(page.getByText("Not published").first()).toBeVisible();

    const site = await page.request.get("/api/portfolio/site");
    expect(site.status()).toBe(200);
    expect(site.headers()["cache-control"]).toContain("no-store");
    expect(await site.json()).toEqual({ state: "unavailable" });
  });

  test("refuse to publish: from another site, and without a GitHub App", async ({ page }) => {
    await openPage(page, "/portfolio");
    const crossSite = await page.request.post("/api/portfolio/publish", {
      data: { portfolio: PORTFOLIO },
      headers: { Origin: "https://attacker.example" },
    });
    expect(crossSite.status()).toBe(403);

    const sameSite = await page.request.post("/api/portfolio/publish", { data: { portfolio: PORTFOLIO }, headers: { Origin: ORIGIN } });
    expect(sameSite.status()).toBe(503);
    expect(await sameSite.json()).toMatchObject({ ok: false, error: { code: "not_configured" } });

    const status = await page.request.get(`/api/portfolio/publish/status?commit=${SHA}`);
    expect(status.status()).toBe(503);

    const connect = await page.request.get("/api/github/app/connect", { maxRedirects: 0 });
    expect(connect.status()).toBe(307);
    expect(connect.headers().location).toContain("/portfolio?github=unavailable");
  });

  test.describe("signed out", () => {
    test.use({ signedIn: false });
    test("require a session", async ({ request }) => {
      expect((await request.get("/api/portfolio/site")).status()).toBe(401);
      expect((await request.post("/api/portfolio/publish", { data: { portfolio: PORTFOLIO }, headers: { Origin: ORIGIN } })).status()).toBe(401);
      expect((await request.get("/api/github/app/connect", { maxRedirects: 0 })).status()).toBe(401);
      expect((await request.get("/api/github/app/callback?code=x&state=y", { maxRedirects: 0 })).status()).toBe(401);
    });
  });
});

test("Journey D: publish to GitHub Pages, wait for the build, and keep the live address after reload", async ({ page }) => {
  const published: unknown[] = [];
  await page.route("**/api/portfolio/site", (route) => route.fulfill({ json: READY_SITE }));
  await page.route("**/api/portfolio/publish", async (route) => {
    published.push(route.request().postDataJSON());
    await route.fulfill({
      json: {
        ok: true,
        value: {
          repository: "octo-sample/octo-sample.github.io",
          commitSha: SHA,
          siteUrl: "https://octo-sample.github.io/",
          settingsUrl: "https://github.com/octo-sample/octo-sample.github.io/settings/pages",
          pagesSetup: "ready",
        },
      },
    });
  });
  let statusChecks = 0;
  await page.route("**/api/portfolio/publish/status?*", (route) => {
    statusChecks += 1;
    return route.fulfill({
      json:
        statusChecks < 2
          ? { ok: true, value: { state: "building" } }
          : { ok: true, value: { state: "built", url: "https://octo-sample.github.io/", builtAt: "2026-10-31T10:01:00Z" } },
    });
  });

  await openPage(page, "/portfolio");
  await saveName(page, "Test Developer");
  await expect(page.getByText(/Publishes to/)).toContainText("octo-sample/octo-sample.github.io");

  await page.getByRole("button", { name: "Publish" }).click();
  const dialog = page.getByRole("dialog", { name: "Publish your portfolio?" });
  await expect(dialog).toContainText("Your email address isn't published.");
  const results = await new AxeBuilder({ page }).include('[role="dialog"]').withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(results.violations.map((violation) => violation.id)).toEqual([]);
  await dialog.getByRole("button", { name: "Publish" }).click();
  await expect(dialog).toBeHidden();

  // Committed, but not claimed as published until GitHub reports the build.
  await expect(page.getByRole("region", { name: /Notifications/ }).getByText("Committed to GitHub")).toBeVisible();
  await expect(page.getByText("GitHub Pages is building your site. This usually takes a minute.")).toBeVisible();
  await expect(page.getByText("Published", { exact: true }).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("link", { name: /https:\/\/octo-sample\.github\.io\// }).first()).toBeVisible();
  expect(published).toEqual([{ portfolio: PORTFOLIO, confirm: {} }]);

  await page.reload();
  await openPage(page, "/portfolio");
  await expect(page.getByText("Published", { exact: true }).first()).toBeVisible();
  await openPage(page, "/");
  await expect(page.getByText("Live at")).toBeVisible();
});

test("the GitHub callback's outcome is shown on the Portfolio page and can be dismissed", async ({ page }) => {
  await openPage(page, "/portfolio?github=invalid");
  const notice = page.getByRole("alert").filter({ hasText: "GitHub wasn't connected" });
  await expect(notice).toContainText("Choose “Connect GitHub” again.");
  await notice.getByRole("button", { name: "Dismiss" }).click();
  await expect(notice).toBeHidden();
  await expect(page).toHaveURL(/\/portfolio$/);
});
