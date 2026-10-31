import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, onboardWithDemo, openPage, test } from "./fixtures";

/**
 * Automated WCAG 2.2 A/AA scan (T9.7). axe finds a subset of issues only;
 * keyboard, focus, and announcement behavior are covered by the other specs
 * and by manual review (memory.md).
 */
async function scan(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  const summary = results.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    help: v.help,
    targets: v.nodes.map((node) => node.target.join(" ")).slice(0, 5),
  }));
  expect(summary, "axe violations").toEqual([]);
}

const PATHS = ["/", "/onboarding", "/sources", "/review", "/portfolio", "/resumes", "/settings"];

for (const theme of ["light", "dark"] as const) {
  test(`no axe violations on every page in the ${theme} theme`, async ({ page }) => {
    test.slow();
    await onboardWithDemo(page);
    await page.getByRole("button", { name: /^Approve “Command-line tool/ }).click();
    // Expanded details, so badges and evidence are scanned too.
    await page.getByRole("button", { name: "Show evidence and source" }).first().click();
    await page.evaluate((value) => window.localStorage.setItem("updater:theme", value), theme);
    for (const path of PATHS) {
      await openPage(page, path);
      if (path === "/review") await page.getByRole("button", { name: "Show evidence and source" }).first().click();
      await scan(page);
    }
    // A resume builder with content.
    await openPage(page, "/resumes");
    await page.getByRole("button", { name: "New resume" }).click();
    await page.getByRole("textbox", { name: /Target role/ }).fill("Backend Engineer");
    await page.getByRole("button", { name: "Create resume" }).click();
    await page.waitForURL(/\/resumes\/[^/]+$/);
    await expect(page.getByRole("region", { name: "Resume preview" })).toBeVisible();
    await scan(page);
  });
}

test.describe("signed out", () => {
  test.use({ signedIn: false });
  test("the sign-in page has no axe violations", async ({ page }) => {
    await page.goto("/sign-in");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await scan(page);
  });
});

test("reduced motion turns off transitions and animations", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openPage(page, "/");
  await page.getByRole("button", { name: "Dark theme" }).click();
  const durations = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("button, a, [role=status], [data-state]")].map((element) => {
      const style = getComputedStyle(element);
      return Math.max(parseFloat(style.transitionDuration) || 0, parseFloat(style.animationDuration) || 0);
    }),
  );
  expect(Math.max(0, ...durations)).toBeLessThanOrEqual(0.01);
});

test("focus is visible on interactive controls", async ({ page }) => {
  await openPage(page, "/settings");
  await page.keyboard.press("Tab"); // skip link
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press("Tab");
    const outline = await page.evaluate(() => {
      const element = document.activeElement as HTMLElement | null;
      if (!element || element === document.body) return null;
      const style = getComputedStyle(element);
      return { tag: element.tagName, outline: style.outlineStyle, width: parseFloat(style.outlineWidth), shadow: style.boxShadow };
    });
    expect(outline, "something has focus").not.toBeNull();
    expect(
      outline!.outline !== "none" && outline!.width >= 2 ? true : outline!.shadow !== "none",
      `visible focus on ${outline!.tag}`,
    ).toBe(true);
  }
});
