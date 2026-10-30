import { ACCOUNT_A, ACCOUNT_B, SESSION_COOKIE, expect, onboardWithDemo, openPage, signIn, test } from "./fixtures";

test.describe("signed out", () => {
  test.use({ signedIn: false });

  test("pages redirect to sign-in and keep the destination", async ({ page }) => {
    await page.goto("/resumes?x=1");
    await expect(page).toHaveURL("/sign-in?callbackUrl=%2Fresumes%3Fx%3D1");
    await expect(page.getByRole("heading", { level: 1, name: "Sign in to Updater" })).toBeVisible();
    const form = page.getByRole("main").locator("form");
    await expect(form.getByRole("button", { name: "Continue with Google" })).toBeVisible();
    await expect(form.locator('input[name="callbackUrl"]')).toHaveValue("/resumes?x=1");
  });

  test("an off-site callback URL is replaced with the Overview", async ({ page }) => {
    for (const target of ["https%3A%2F%2Fevil.example.com%2F", "%2F%2Fevil.example.com"]) {
      await page.goto(`/sign-in?callbackUrl=${target}`);
      // Wait for the streamed form, so React has swapped out the placeholder.
      const form = page.getByRole("main").locator("form");
      await expect(form.getByRole("button", { name: "Continue with Google" })).toBeVisible();
      await expect(form.locator('input[name="callbackUrl"]')).toHaveValue("/");
    }
  });

  test("Auth.js errors show a fixed message, never the raw code", async ({ page }) => {
    await page.goto("/sign-in?error=%3Cscript%3Ealert(1)%3C%2Fscript%3E");
    await expect(page.getByRole("main").getByText("Sign-in didn't complete")).toBeVisible();
    await expect(page.locator("body")).not.toContainText("<script>");
  });

  test("responses refuse framing and send baseline security headers", async ({ request }) => {
    for (const path of ["/sign-in", "/api/account"]) {
      const headers = (await request.get(path)).headers();
      expect(headers["x-frame-options"], path).toBe("DENY");
      expect(headers["content-security-policy"], path).toContain("frame-ancestors 'none'");
      expect(headers["x-content-type-options"], path).toBe("nosniff");
      expect(headers["referrer-policy"], path).toBe("strict-origin-when-cross-origin");
      expect(headers["x-powered-by"], path).toBeUndefined();
    }
  });

  test("API requests get 401, and the account endpoint says signed out", async ({ request }) => {
    expect((await request.get("/api/anything")).status()).toBe(401);
    const account = await request.get("/api/account");
    expect(account.headers()["cache-control"]).toContain("no-store");
    expect(await account.json()).toEqual({ status: "signed_out" });
  });

  test("a tampered session cookie is rejected", async ({ context, page }) => {
    await signIn(context);
    const [cookie] = await context.cookies();
    await context.addCookies([{ ...cookie, value: `${cookie.value.slice(0, -4)}AAAA` }]);
    await page.goto("/portfolio");
    await expect(page).toHaveURL(/\/sign-in\?callbackUrl=%2Fportfolio/);
  });

  test("Continue with Google starts a real OAuth request with PKCE and state", async ({ page }) => {
    await page.goto("/sign-in");
    const [request] = await Promise.all([
      page.waitForRequest((r) => r.url().startsWith("https://accounts.google.com/")),
      page.getByRole("button", { name: "Continue with Google" }).click(),
    ]);
    const url = new URL(request.url());
    expect(url.searchParams.get("client_id")).toBe("e2e-dummy.apps.googleusercontent.com");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("state")).toBeTruthy();
    expect(url.searchParams.get("redirect_uri")).toBe("http://localhost:3100/api/auth/callback/google");
  });
});

test.describe("signed in", () => {
  test("the session cookie is HTTP-only and nothing token-like is in browser storage", async ({ context, page }) => {
    await onboardWithDemo(page);
    const cookie = (await context.cookies()).find((c) => c.name === SESSION_COOKIE);
    expect(cookie?.httpOnly).toBe(true);
    const stored = await page.evaluate(() => JSON.stringify({ ...window.localStorage }));
    expect(stored).not.toMatch(/token|secret|password|authjs/i);
    expect(await page.evaluate(() => document.cookie)).not.toContain(SESSION_COOKIE);
  });

  test("pages, prefetches, and the account endpoint never re-issue the session cookie", async ({ page }) => {
    // A late response re-issuing the session could undo a sign-out (src/lib/auth/session-cookies.ts).
    for (const [path, headers, status] of [
      ["/portfolio", {}, 200],
      // Shaped like a router prefetch. Next.js answers an unexpected `_rsc` hash with a
      // redirect, after the proxy ran, so its headers still show what the proxy wrote.
      ["/review?_rsc=e2e", { RSC: "1", "Next-Router-Prefetch": "1" }, 307],
      ["/api/account", {}, 200],
    ] as const) {
      const response = await page.request.get(path, { headers, maxRedirects: 0 });
      expect(response.status(), path).toBe(status);
      const writes = response.headersArray().filter((h) => h.name.toLowerCase() === "set-cookie" && /authjs\.session-token=[^;]/.test(h.value));
      expect(writes, path).toEqual([]);
    }
  });

  test("each account sees only its own workspace", async ({ page }) => {
    await onboardWithDemo(page, "First Account Name");
    await openPage(page, "/settings");
    await expect(page.getByText(`${ACCOUNT_A.name} · ${ACCOUNT_A.email}`)).toBeVisible();

    // Same browser profile (shared localStorage), different account.
    const context = page.context();
    await context.clearCookies();
    await signIn(context, ACCOUNT_B);
    await openPage(page, "/portfolio");
    await expect(page.getByRole("textbox", { name: "Name (required)" })).toHaveValue("");
    await openPage(page, "/review");
    await expect(page.getByRole("heading", { name: "No proposals yet" })).toBeVisible();

    // The first account's data is untouched.
    await context.clearCookies();
    await signIn(context, ACCOUNT_A);
    await openPage(page, "/portfolio");
    await expect(page.getByRole("textbox", { name: "Name (required)" })).toHaveValue("First Account Name");
  });

  test("signing out clears the session and returns to sign-in", async ({ context, page }) => {
    await openPage(page, "/settings");
    await page.getByRole("region", { name: "Account" }).getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/sign-in/);
    expect((await context.cookies()).find((c) => c.name === SESSION_COOKIE)).toBeUndefined();
    await page.goto("/");
    await expect(page).toHaveURL(/\/sign-in/);
  });
});
