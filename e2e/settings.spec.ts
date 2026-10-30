import { readFile } from "node:fs/promises";
import { ACCOUNT_A, expect, onboardWithDemo, openPage, test, workspaceKey } from "./fixtures";

const WORKSPACE_KEY = workspaceKey();

test.describe("Settings: data", () => {
  test("reset needs confirmation, Cancel keeps everything, and the theme survives", async ({ page }) => {
    await onboardWithDemo(page);
    await openPage(page, "/settings");
    await page.getByRole("button", { name: "Dark theme" }).click();

    await page.getByRole("button", { name: "Reset workspace…" }).click();
    let dialog = page.getByRole("alertdialog", { name: "Reset workspace?" });
    await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();
    await dialog.getByRole("button", { name: "Cancel" }).click();
    expect(await page.evaluate((key) => window.localStorage.getItem(key), WORKSPACE_KEY)).not.toBeNull();

    await page.getByRole("button", { name: "Reset workspace…" }).click();
    dialog = page.getByRole("alertdialog", { name: "Reset workspace?" });
    await expect(dialog).toContainText(/proposal|item|resume/i);
    await dialog.getByRole("button", { name: "Reset workspace" }).click();
    await expect(dialog).toBeHidden();
    await openPage(page, "/review");
    await expect(page.getByRole("heading", { name: "No proposals yet" })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  });

  test("export downloads the workspace; a malformed import changes nothing; a valid one replaces after confirmation", async ({
    page,
  }, testInfo) => {
    await onboardWithDemo(page);
    await openPage(page, "/settings");

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Export JSON" }).click(),
    ]);
    const exportPath = testInfo.outputPath("export.json");
    await download.saveAs(exportPath);
    const exported = JSON.parse(await readFile(exportPath, "utf8"));
    expect(exported.workspace?.profile?.name ?? exported.profile?.name).toBe(ACCOUNT_A.name);

    const before = await page.evaluate((key) => window.localStorage.getItem(key), WORKSPACE_KEY);
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({ name: "broken.json", mimeType: "application/json", buffer: Buffer.from("{ not json") });
    await expect(page.getByText("Import failed. Nothing was changed.")).toBeVisible();
    await fileInput.setInputFiles({
      name: "tampered.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify({ ...exported, githubToken: "ghp_example" })),
    });
    await expect(page.getByText("Import failed. Nothing was changed.")).toBeVisible();
    expect(await page.evaluate((key) => window.localStorage.getItem(key), WORKSPACE_KEY)).toBe(before);

    // Reset, then restore from the export.
    await page.getByRole("button", { name: "Reset workspace…" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Reset workspace" }).click();
    await fileInput.setInputFiles(exportPath);
    const confirm = page.getByRole("alertdialog", { name: "Replace workspace?" });
    await expect(confirm).toContainText("export.json");
    await confirm.getByRole("button", { name: "Replace workspace" }).click();
    await openPage(page, "/review");
    await expect(page.getByRole("tab", { name: /Needs review/ })).toHaveAccessibleName(/8/);
  });

  test("removing demo data asks first and keeps the user's own entries", async ({ page }) => {
    await onboardWithDemo(page);
    await openPage(page, "/settings");
    await page.getByRole("region", { name: "Data" }).getByRole("button", { name: "Remove demo data" }).click();
    const dialog = page.getByRole("alertdialog", { name: "Remove demo data?" });
    await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();
    await dialog.getByRole("button", { name: "Remove demo data" }).click();
    await expect(dialog).toBeHidden();
    await openPage(page, "/");
    await expect(page.getByText("Your workspace includes demo data")).toHaveCount(0);
    await expect(page.getByRole("banner").getByRole("link", { name: /demo data/i })).toHaveCount(0);
  });
});

test.describe("recovery", () => {
  test("a corrupt stored workspace shows the recovery screen instead of crashing", async ({ page }) => {
    await openPage(page, "/");
    await page.evaluate((key) => window.localStorage.setItem(key, "{ corrupt"), WORKSPACE_KEY);
    await page.reload();
    await expect(page.getByText("Your saved workspace couldn't be loaded")).toBeVisible();
    await expect(page.getByRole("button", { name: "Export raw data" })).toBeVisible();
  });
});
