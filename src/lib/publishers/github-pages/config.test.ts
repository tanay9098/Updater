import { describe, expect, it } from "vitest";
import { installUrl, readGithubAppConfig } from "./config";

const KEY = "-----BEGIN RSA PRIVATE KEY-----\\nMIIB\\n-----END RSA PRIVATE KEY-----";
const FULL = {
  GITHUB_APP_ID: "123456",
  GITHUB_APP_SLUG: "updater-portfolio",
  GITHUB_APP_CLIENT_ID: "Iv23liExample",
  GITHUB_APP_CLIENT_SECRET: "secret",
  GITHUB_APP_PRIVATE_KEY: KEY,
};

describe("readGithubAppConfig (T10.9)", () => {
  it("is ready when every variable is set, and restores newlines in a one-line key", () => {
    const config = readGithubAppConfig(FULL);
    expect(config.state).toBe("ready");
    if (config.state === "ready") expect(config.privateKey).toBe("-----BEGIN RSA PRIVATE KEY-----\nMIIB\n-----END RSA PRIVATE KEY-----");
  });

  it("lists missing variables; publishing is then off and nothing else is affected", () => {
    expect(readGithubAppConfig({})).toEqual({
      state: "missing",
      missing: ["GITHUB_APP_ID", "GITHUB_APP_SLUG", "GITHUB_APP_CLIENT_ID", "GITHUB_APP_CLIENT_SECRET", "GITHUB_APP_PRIVATE_KEY"],
    });
    expect(readGithubAppConfig({ ...FULL, GITHUB_APP_SLUG: "  " })).toEqual({ state: "missing", missing: ["GITHUB_APP_SLUG"] });
  });

  it("rejects malformed values", () => {
    expect(readGithubAppConfig({ ...FULL, GITHUB_APP_ID: "abc" }).state).toBe("invalid");
    expect(readGithubAppConfig({ ...FULL, GITHUB_APP_SLUG: "Bad Slug/" }).state).toBe("invalid");
    expect(readGithubAppConfig({ ...FULL, GITHUB_APP_PRIVATE_KEY: "not a key" }).state).toBe("invalid");
  });

  it("builds the installation address from the slug", () => {
    expect(installUrl("updater-portfolio")).toBe("https://github.com/apps/updater-portfolio/installations/new");
  });
});
