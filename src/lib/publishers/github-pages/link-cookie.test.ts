import { describe, expect, it } from "vitest";
import { openLink, openPendingAuthorization, sealLink, sealPendingAuthorization } from "./link-cookie";

const SECRET = "unit-test-secret-not-real-0123456789abcdef";
const LINK = { githubUserId: 42, login: "octo-sample" };

describe("link cookie (T10.9, D-037)", () => {
  it("round-trips the linked GitHub account for the same Updater account", async () => {
    const sealed = await sealLink(SECRET, "google:1", LINK);
    expect(sealed).not.toContain("octo-sample");
    expect(await openLink(SECRET, "google:1", sealed)).toEqual(LINK);
  });

  it("is useless to another Updater account, another secret, or after tampering", async () => {
    const sealed = await sealLink(SECRET, "google:1", LINK);
    expect(await openLink(SECRET, "google:2", sealed)).toBeNull();
    expect(await openLink(`${SECRET}-other`, "google:1", sealed)).toBeNull();
    expect(await openLink(SECRET, "google:1", `${sealed.slice(0, -4)}AAAA`)).toBeNull();
    expect(await openLink(SECRET, "google:1", undefined)).toBeNull();
  });

  it("keeps the pending authorization and the link apart (different salts)", async () => {
    const pending = { accountId: "google:1", state: "s".repeat(43), codeVerifier: "v".repeat(43) };
    const sealed = await sealPendingAuthorization(SECRET, pending);
    expect(await openPendingAuthorization(SECRET, sealed)).toEqual(pending);
    expect(await openLink(SECRET, "google:1", sealed)).toBeNull();
    expect(await openPendingAuthorization(SECRET, await sealLink(SECRET, "google:1", LINK))).toBeNull();
  });
});
