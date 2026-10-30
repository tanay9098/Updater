import type { Page } from "@playwright/test";
import { expect, onboardWithDemo, openPage, test } from "./fixtures";

/** Toasts confirm only after the store saved (FR-REV/rules.md §7.2.6). */
async function expectToast(page: Page, title: string | RegExp) {
  await expect(page.getByRole("region", { name: /Notifications/ }).getByText(title)).toBeVisible();
}

test.describe("Journey A: getting started", () => {
  test("empty Overview recommends only onboarding, with no redirect", async ({ page }) => {
    await openPage(page, "/");
    await expect(page).toHaveURL("/");
    await expect(page.getByRole("link", { name: /Get started/ })).toBeVisible();
    await expect(page.getByText("Your workspace includes demo data")).toHaveCount(0);
  });

  test("profile validation, skippable steps, and the choice persist after reload", async ({ page }) => {
    await openPage(page, "/onboarding");
    await expect(page.getByText("Step 1 of 3")).toBeVisible();
    await page.getByRole("button", { name: "Get started" }).click();

    const name = page.getByRole("textbox", { name: "Name (required)" });
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(name).toHaveAttribute("aria-invalid", "true");
    await expect(name).toHaveAccessibleDescription(/./);

    // Whitespace only is still empty; the field's maxLength already stops over-long names.
    await name.fill("   ");
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(name).toHaveAttribute("aria-invalid", "true");
    await expect(name).toHaveAttribute("maxlength", "100");

    await name.fill("Test Developer");
    await page.getByRole("textbox", { name: "Headline" }).fill("Frontend engineer");
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(page.getByText("Step 3 of 3")).toBeVisible();
    await expect(page.getByText(/Planned integrations/)).toBeVisible();
    await expect(page.getByRole("button", { name: /connect/i })).toHaveCount(0);
    await page.getByRole("radio", { name: "Skip for now" }).check();
    await page.getByRole("button", { name: "Finish setup" }).click();
    await expect(page).toHaveURL("/");

    await page.reload();
    await openPage(page, "/");
    await expect(page.getByRole("link", { name: /Get started/ })).toHaveCount(0);
    await openPage(page, "/portfolio");
    await expect(page.getByRole("textbox", { name: "Name (required)" })).toHaveValue("Test Developer");
    await expect(page.getByRole("textbox", { name: "Headline" })).toHaveValue("Frontend engineer");
  });
});

test.describe("Journey B: sources", () => {
  test("planned integrations are never presented as connected", async ({ page }) => {
    await openPage(page, "/sources");
    for (const name of ["GitHub", "Blog feeds (RSS/Atom)"]) {
      const card = page.getByRole("region", { name });
      await expect(card.getByText("Planned", { exact: true })).toBeVisible();
      await expect(card.getByRole("button")).toHaveCount(0);
    }
    await expect(page.getByRole("main")).not.toContainText(/\bConnected\b/);
    await expect(page.getByRole("region", { name: "Demo workspace" }).getByText("Not loaded", { exact: true })).toBeVisible();
  });

  test("a manual entry validates input, becomes user-supplied evidence, and proposes a review item", async ({ page }) => {
    await openPage(page, "/sources");
    await page.getByRole("button", { name: "Add entry" }).click();
    const dialog = page.getByRole("dialog", { name: "Add a manual entry" });
    await dialog.getByRole("button", { name: "Add entry" }).click();
    await expect(dialog.getByRole("textbox", { name: /Title/ })).toHaveAttribute("aria-invalid", "true");

    await dialog.getByRole("textbox", { name: /Title/ }).fill("Garden planner");
    await dialog.getByRole("textbox", { name: /Description/ }).fill("Built a small app to plan vegetable beds.");
    const link = dialog.getByRole("textbox", { name: /Link/ });
    await link.fill("javascript:alert(1)");
    await dialog.getByRole("button", { name: "Add entry" }).click();
    await expect(link).toHaveAttribute("aria-invalid", "true");
    await link.fill("https://garden.example.com/");
    await dialog.getByRole("button", { name: "Add entry" }).click();
    await expect(dialog).toBeHidden();

    const manual = page.getByRole("region", { name: "Manual entries" });
    await expect(manual.getByText("Garden planner")).toBeVisible();
    const external = manual.getByRole("link", { name: /Garden planner|Open/ }).first();
    await expect(external).toHaveAttribute("rel", /noopener/);
    await expect(external).toHaveAttribute("target", "_blank");

    await page.reload();
    await openPage(page, "/review");
    await expect(page.getByRole("article", { name: /Garden planner|plan vegetable beds/ })).toBeVisible();
    await page.getByRole("button", { name: "Show evidence and source" }).first().click();
    await expect(page.getByText("User-supplied").first()).toBeVisible();
  });
});

test.describe("Journey C: review queue", () => {
  test("provenance, edit with original kept, approve, dismiss, restore, reload", async ({ page }) => {
    await onboardWithDemo(page);
    await expect(page.getByRole("tab", { name: /Needs review/ })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByText("Demo data").first()).toBeVisible();

    // Provenance details.
    const tidepool = page.getByRole("article", { name: /^New project: Command-line tool/ });
    await tidepool.getByRole("button", { name: "Show evidence and source" }).click();
    await expect(tidepool.getByRole("heading", { name: "Why suggested" })).toBeVisible();
    await expect(tidepool.getByRole("heading", { name: "Evidence" })).toBeVisible();
    const source = tidepool.getByRole("link", { name: /Open source/ });
    await expect(source).toHaveAttribute("href", /^https:\/\/([a-z0-9-]+\.)*example\.com\//);
    await expect(source).toHaveAttribute("rel", /noopener/);

    // Edit keeps the original.
    await tidepool.getByRole("button", { name: /^Edit/ }).click();
    await tidepool.getByRole("textbox", { name: /Proposed text/ }).fill("Command-line tool for tide tables.");
    await tidepool.getByRole("button", { name: "Save edit" }).click();
    await expectToast(page, "Edit saved");
    await page.getByRole("tab", { name: /Edited/ }).click();
    const edited = page.getByRole("article", { name: /Command-line tool for tide tables/ });
    await edited.getByRole("button", { name: "Show evidence and source" }).click();
    await edited.getByRole("button", { name: "Show original proposal" }).click();
    await expect(edited.getByText("Command-line tool that summarizes tide tables from public CSV files.")).toBeVisible();

    // Approve: added to the draft, never published.
    await edited.getByRole("button", { name: /^Approve/ }).click();
    await expectToast(page, "Approved and added to your portfolio draft. Not published.");

    // Dismiss keeps evidence; restore brings it back.
    await page.getByRole("tab", { name: /Needs review/ }).click();
    await page.getByRole("button", { name: "Dismiss “Go”" }).click();
    const dismiss = page.getByRole("dialog", { name: "Dismiss this proposal?" });
    await dismiss.getByRole("textbox", { name: "Reason" }).fill("Not current");
    await dismiss.getByRole("button", { name: "Dismiss proposal" }).click();
    await expectToast(page, "Dismissed. Evidence kept.");

    await page.reload();
    await openPage(page, "/review");
    await expect(page.getByRole("tab", { name: /Approved/ })).toHaveAccessibleName(/Approved\s*,\s*1/);
    await page.getByRole("tab", { name: /Dismissed/ }).click();
    await expect(page.getByText("Reason: Not current")).toBeVisible();

    // The dismissed skill's source item and evidence are still on Sources.
    await openPage(page, "/sources");
    await page.getByRole("button", { name: /Show 6 items/ }).click();
    await expect(page.getByRole("region", { name: "Demo workspace" }).getByText("tidepool").first()).toBeVisible();

    await openPage(page, "/review");
    await page.getByRole("tab", { name: /Dismissed/ }).click();
    await page.getByRole("button", { name: "Restore “Go”" }).click();
    await expectToast(page, "Restored");
    await page.getByRole("tab", { name: /Needs review/ }).click();
    await expect(page.getByRole("article", { name: "New skill: Go" })).toBeVisible();

    // The approved project is in the portfolio draft with its edited wording.
    await openPage(page, "/portfolio");
    await expect(page.getByRole("region", { name: "Projects" }).getByText("tidepool").first()).toBeVisible();
    await expect(page.getByText("Not published").first()).toBeVisible();
  });

  test("approving conflicting evidence requires acknowledgement", async ({ page }) => {
    await onboardWithDemo(page);
    const item = page.getByRole("article", { name: /^New project: Offline-first/ });
    await item.getByRole("button", { name: /^Approve/ }).click();
    const dialog = page.getByRole("dialog", { name: "Check the conflict before approving" });
    const approve = dialog.getByRole("button", { name: "Approve" });
    await expect(approve).toBeDisabled();
    await dialog.getByRole("checkbox", { name: "I've checked this conflict" }).click();
    await approve.click();
    await expectToast(page, /Approved and added/);
    await expect(page.getByRole("article", { name: /^New project: Offline-first/ })).toHaveCount(0);
  });
});

test.describe("Journey D: portfolio", () => {
  test("edit, validate links, preview, and publish stays unavailable", async ({ page }) => {
    await onboardWithDemo(page);
    await page.getByRole("button", { name: /^Approve “Command-line tool/ }).click();
    await openPage(page, "/portfolio");

    await expect(page.getByRole("button", { name: "Publish" })).toBeDisabled();
    await expect(page.getByText("Publishing isn't available in this version.").first()).toBeVisible();

    const profile = page.getByRole("region", { name: "Profile" });
    await profile.getByRole("textbox", { name: "Introduction" }).fill("I build small, careful tools.");
    await expect(page.getByText(/Unsaved changes/).first()).toBeVisible();
    await profile.getByRole("button", { name: "Save profile" }).click();
    await expectToast(page, "Profile saved");

    const links = page.getByRole("region", { name: "Links" });
    await links.getByRole("button", { name: "Add profile link" }).click();
    await links.getByRole("textbox", { name: /Label/ }).fill("Blog");
    const url = links.getByRole("textbox", { name: /URL/ });
    await url.fill("javascript:alert(1)");
    await links.getByRole("button", { name: "Save links" }).click();
    await expect(url).toHaveAttribute("aria-invalid", "true");
    await url.fill("https://blog.example.com/");
    await links.getByRole("button", { name: "Save links" }).click();
    await expectToast(page, "Links saved");

    const preview = page.getByRole("region", { name: "Local preview: not published" });
    await expect(preview.getByText("I build small, careful tools.")).toBeVisible();
    await expect(preview.getByRole("link", { name: "Blog" })).toHaveAttribute("href", "https://blog.example.com/");
    await expect(preview.getByText("tidepool").first()).toBeVisible();
    await expect(preview.getByText("Demo data").first()).toBeVisible();

    // Evidence for a source-backed claim stays reachable from the editor.
    await page.getByRole("region", { name: "Projects" }).getByRole("button", { name: /evidence/i }).first().click();
    await expect(page.getByRole("dialog").getByRole("link", { name: /Open source/ }).first()).toHaveAttribute("href", /example\.com/);
    await page.keyboard.press("Escape");

    await page.reload();
    await openPage(page, "/portfolio");
    await expect(page.getByRole("textbox", { name: "Introduction" })).toHaveValue("I build small, careful tools.");
    await expect(page.getByRole("main")).not.toContainText(/\bPublished\b(?! portfolio)/);
  });
});

test.describe("Journey E: resumes", () => {
  test("create for a role, select content, write a summary, save, and print", async ({ page }) => {
    await onboardWithDemo(page);
    await page.getByRole("button", { name: /^Approve “Command-line tool/ }).click();
    await page.getByRole("button", { name: "Approve “Go”" }).click();

    await openPage(page, "/resumes");
    await page.getByRole("button", { name: "New resume" }).click();
    const dialog = page.getByRole("dialog", { name: "New resume" });
    await dialog.getByRole("button", { name: "Create resume" }).click();
    await expect(dialog.getByRole("textbox", { name: /Target role/ })).toHaveAttribute("aria-invalid", "true");
    await dialog.getByRole("textbox", { name: /Target role/ }).fill("Backend Engineer");
    await dialog.getByRole("button", { name: "Create resume" }).click();
    await page.waitForURL(/\/resumes\/[^/]+$/);
    await expect(page.getByRole("heading", { level: 2, name: "Backend Engineer" })).toBeVisible();

    await page.getByRole("checkbox", { name: /tidepool/ }).first().check();
    await page.getByRole("checkbox", { name: /^Go/ }).first().check();
    await page.getByRole("textbox", { name: "Summary", exact: true }).fill("Developer who writes small command-line tools.");
    const preview = page.getByRole("region", { name: "Resume preview" });
    await expect(preview.getByText("Developer who writes small command-line tools.")).toBeVisible();
    await expect(preview.getByText("tidepool").first()).toBeVisible();
    // Skills render as one comma-separated line under their heading.
    await expect(preview.getByRole("heading", { name: "Skills" })).toBeVisible();
    await expect(preview).toContainText(/Skills\s*Go\b/);

    await page.getByRole("button", { name: "Save draft" }).click();
    await expectToast(page, "Resume draft saved");
    await expect(page.getByRole("button", { name: "Save draft" })).toBeDisabled();
    await expect(page.getByText(/applicant tracking systems/)).toBeVisible();

    await page.reload();
    await expect(page.getByRole("textbox", { name: "Summary", exact: true })).toHaveValue("Developer who writes small command-line tools.");

    // Print: app chrome hidden, resume readable black on white even in the dark theme.
    await page.getByRole("button", { name: "Dark theme" }).click();
    await page.emulateMedia({ media: "print" });
    await expect(page.getByRole("navigation", { name: "Primary" })).toBeHidden();
    await expect(page.getByRole("button", { name: "Print / Save as PDF" })).toBeHidden();
    const printed = page.locator(".resume-print");
    await expect(printed).toBeVisible();
    await expect(printed.getByText("Developer who writes small command-line tools.")).toBeVisible();
    const colors = await printed.evaluate((element) => {
      const style = getComputedStyle(element);
      return { color: style.color, background: getComputedStyle(document.body).backgroundColor };
    });
    expect(colors.color).toBe("rgb(0, 0, 0)");
    expect(colors.background).toMatch(/rgb\(255, 255, 255\)|rgba\(0, 0, 0, 0\)/);
  });

  test("a resume id that doesn't exist says so", async ({ page }) => {
    await openPage(page, "/resumes/does-not-exist");
    await expect(page.getByRole("heading", { name: "Resume not found" })).toBeVisible();
  });
});
