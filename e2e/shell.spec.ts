import { expect, expectNoHorizontalOverflow, onboardWithDemo, openPage, test } from "./fixtures";

const PAGES = [
  { link: "Overview", path: "/", heading: "Overview" },
  { link: "Sources", path: "/sources", heading: "Sources" },
  { link: "Review Queue", path: "/review", heading: "Review Queue" },
  { link: "Portfolio", path: "/portfolio", heading: "Portfolio" },
  { link: "Resumes", path: "/resumes", heading: "Resumes" },
  { link: "Settings", path: "/settings", heading: "Settings" },
];

test.describe("application shell", () => {
  test("navigation marks the current page and moves focus to its heading", async ({ page }) => {
    // Start elsewhere, so the first click (Overview) is a real navigation.
    await openPage(page, "/settings");
    const nav = page.getByRole("navigation", { name: "Primary" });
    for (const { link, path, heading } of PAGES) {
      await nav.getByRole("link", { name: link }).click();
      await expect(page).toHaveURL(path);
      const h1 = page.getByRole("heading", { level: 1, name: heading });
      await expect(h1).toBeVisible();
      await expect(h1).toBeFocused();
      await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
      await expect(nav.getByRole("link", { name: link })).toHaveAttribute("aria-current", "page");
      await expect(page).toHaveTitle(heading === "Overview" ? "Overview · Updater" : `${heading} · Updater`);
    }
  });

  test("the skip link is first in tab order and focuses main", async ({ page }) => {
    await openPage(page, "/sources");
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Skip to content" });
    await expect(skip).toBeFocused();
    await expect(skip).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page.locator("main")).toBeFocused();
  });

  test("landmarks: one banner, one main, a primary navigation", async ({ page }) => {
    await openPage(page, "/");
    await expect(page.getByRole("banner")).toHaveCount(1);
    await expect(page.getByRole("main")).toHaveCount(1);
    await expect(page.getByRole("navigation", { name: "Primary" })).toHaveCount(1);
  });

  test.describe(() => {
    test.use({ allowedConsoleErrors: [/status of 404/] });
    test("unknown routes show the not-found page", async ({ page }) => {
    const response = await page.goto("/does-not-exist");
      expect(response?.status()).toBe(404);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    });
  });

  test("the mobile drawer opens, closes on Escape, and returns focus", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await openPage(page, "/");
    await expect(page.getByRole("navigation", { name: "Primary" })).toBeHidden();
    const trigger = page.getByRole("button", { name: "Open navigation" });
    await trigger.click();
    const drawer = page.getByRole("dialog");
    await expect(drawer.getByRole("link", { name: "Resumes" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
    await expect(trigger).toBeFocused();

    await trigger.click();
    await page.getByRole("dialog").getByRole("link", { name: "Resumes" }).click();
    await expect(page).toHaveURL("/resumes");
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page.getByRole("heading", { level: 1, name: "Resumes" })).toBeVisible();
  });
});

test.describe("themes", () => {
  test("bright is the default even when the OS prefers dark", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await openPage(page, "/");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(page.getByRole("button", { name: "Dark theme" })).toHaveAttribute("aria-pressed", "false");
  });

  test("the toggle switches theme, stays in sync with Settings, and persists", async ({ page }) => {
    await openPage(page, "/settings");
    const toggle = page.getByRole("button", { name: "Dark theme" });
    await toggle.click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("radio", { name: "Dark" })).toBeChecked();

    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.getByRole("radio", { name: "Light (default)" }).check();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(page.getByRole("button", { name: "Dark theme" })).toHaveAttribute("aria-pressed", "false");
    expect(await page.evaluate(() => window.localStorage.getItem("updater:theme"))).toBe("light");
  });

  test.describe(() => {
    // The test blocks every script on purpose.
    test.use({ allowedConsoleErrors: [/net::ERR_FAILED/] });
    test("a stored dark theme paints before any script runs", async ({ page, context }) => {
    await openPage(page, "/");
    await page.getByRole("button", { name: "Dark theme" }).click();
    await context.route(/\/_next\/static\/.*\.js$/, (route) => route.abort());
      await page.goto("/portfolio");
      await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    });
  });
});

test.describe("responsive layout", () => {
  for (const width of [320, 768, 1280]) {
    test(`no horizontal scrolling at ${width}px in both themes`, async ({ page }) => {
      test.slow();
      await page.setViewportSize({ width, height: 900 });
      await onboardWithDemo(page);
      // Some approved content, so the portfolio and resumes have rows to lay out.
      await page.getByRole("button", { name: "Approve “Go”" }).click();
      await page.getByRole("button", { name: /^Approve “Command-line tool/ }).click();
      for (const theme of ["light", "dark"] as const) {
        await page.evaluate((value) => window.localStorage.setItem("updater:theme", value), theme);
        for (const path of ["/", "/onboarding", "/sources", "/review", "/portfolio", "/resumes", "/settings"]) {
          await openPage(page, path);
          await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
          await expectNoHorizontalOverflow(page);
        }
      }
    });
  }
});
