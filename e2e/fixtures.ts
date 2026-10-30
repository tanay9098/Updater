import { expect, test as base, type BrowserContext, type Page } from "@playwright/test";
import { encode } from "next-auth/jwt";
import { E2E_AUTH_SECRET, E2E_PORT } from "./env";

/** Auth.js's session cookie name on plain http (https adds the `__Secure-` prefix). */
export const SESSION_COOKIE = "authjs.session-token";

export type TestAccount = { id: string; name: string; email: string };

export const ACCOUNT_A: TestAccount = { id: "google:e2e-account-a", name: "Test Developer", email: "dev-a@example.com" };
export const ACCOUNT_B: TestAccount = { id: "google:e2e-account-b", name: "Other Person", email: "dev-b@example.com" };

/** The same encrypted JWT Auth.js writes after a Google callback, minted with the test secret. */
export async function sessionToken(account: TestAccount): Promise<string> {
  return encode({
    token: { name: account.name, email: account.email, sub: account.id, accountId: account.id },
    secret: E2E_AUTH_SECRET,
    salt: SESSION_COOKIE,
    maxAge: 60 * 60,
  });
}

export async function signIn(context: BrowserContext, account: TestAccount = ACCOUNT_A): Promise<void> {
  await context.addCookies([
    {
      name: SESSION_COOKIE,
      value: await sessionToken(account),
      url: `http://localhost:${E2E_PORT}`,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}

/** Matches `workspaceStorageKeys` in src/lib/data/storage.ts (the account id is URI-encoded). */
export function workspaceKey(account: TestAccount = ACCOUNT_A): string {
  return `updater:workspace:v1:account:${encodeURIComponent(account.id)}`;
}

/** Waits until the account is confirmed and the workspace has loaded (no skeleton left). */
export async function openPage(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Loading your workspace…" })).toHaveCount(0);
}

/** Journey A with the demo choice: profile name, then "Explore with demo data". */
export async function onboardWithDemo(page: Page, name = ACCOUNT_A.name): Promise<void> {
  await openPage(page, "/onboarding");
  await page.getByRole("button", { name: "Get started" }).click();
  await page.getByRole("textbox", { name: "Name (required)" }).fill(name);
  await page.getByRole("button", { name: "Save profile" }).click();
  await page.getByRole("radio", { name: "Explore with demo data" }).check();
  await page.getByRole("button", { name: "Finish setup" }).click();
  await page.waitForURL("**/review");
  await expect(page.getByRole("tab", { name: /Needs review/ })).toBeVisible();
}

export async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `page is ${overflow}px wider than the viewport`).toBeLessThanOrEqual(0);
}

/**
 * Every test is signed in as ACCOUNT_A unless it opts out with
 * `test.use({ signedIn: false })`, and fails on any console error or
 * uncaught exception, except errors the test declares it causes on purpose
 * with `test.use({ allowedConsoleErrors: [...] })`.
 */
export const test = base.extend<{ signedIn: boolean; allowedConsoleErrors: RegExp[]; consoleErrors: string[] }>({
  signedIn: [true, { option: true }],
  allowedConsoleErrors: [[], { option: true }],
  consoleErrors: [
    // The fixture callback is named `provide`, not Playwright's usual `use`, so React's hook lint rule doesn't mistake it for a hook.
    async ({ page, allowedConsoleErrors }, provide) => {
      const errors: string[] = [];
      page.on("console", (message) => {
        const text = message.text();
        if (message.type() === "error" && !allowedConsoleErrors.some((pattern) => pattern.test(text))) errors.push(text);
      });
      page.on("pageerror", (error) => errors.push(error.message));
      await provide(errors);
      expect(errors, "console errors").toEqual([]);
    },
    { auto: true },
  ],
  context: async ({ context, signedIn }, provide) => {
    if (signedIn) await signIn(context);
    await provide(context);
  },
});

export { expect };
