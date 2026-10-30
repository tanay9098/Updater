import { defineConfig, devices } from "@playwright/test";
import { E2E_AUTH_ENV, E2E_PORT } from "./e2e/env";

/**
 * End-to-end tests (T9.9). They run against the production build, so run
 * `npm run build` first; `npm run test:e2e` starts `next start` itself.
 *
 * Sign-in is compulsory (D-031) and a real Google round trip can't run in a
 * test, so the server gets a dummy Google client and a test-only
 * `AUTH_SECRET`, and the tests sign in by setting a real Auth.js session
 * cookie encrypted with that secret (e2e/fixtures.ts). The app itself has
 * no test or bypass mode.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "list" : [["list"]],
  use: {
    baseURL: `http://localhost:${E2E_PORT}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npx next start -p ${E2E_PORT}`,
    url: `http://localhost:${E2E_PORT}/sign-in`,
    // Always a fresh server: a reused one may be a stale build or lack the test AUTH_SECRET.
    reuseExistingServer: false,
    timeout: 60_000,
    env: E2E_AUTH_ENV,
  },
});
