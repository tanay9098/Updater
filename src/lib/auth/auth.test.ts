import { describe, expect, it } from "vitest";
import { decideAccess, isPublicPath, safeCallbackPath } from "./access";
import { accountStateSchema, initialsOf, scopeFromKey, scopeKey, workspaceScopeOf } from "./account";
import { readAuthConfig } from "./config";
import { signInErrorMessage } from "./errors";

describe("readAuthConfig", () => {
  it("is off when nothing is set, so local development needs no credentials", () => {
    expect(readAuthConfig({})).toEqual({ state: "off" });
    expect(readAuthConfig({ AUTH_SECRET: "  ", AUTH_GOOGLE_ID: "" })).toEqual({ state: "off" });
  });

  it("fails closed when only part of the configuration is set", () => {
    expect(readAuthConfig({ AUTH_GOOGLE_ID: "id" })).toEqual({
      state: "incomplete",
      missing: ["AUTH_SECRET", "AUTH_GOOGLE_SECRET"],
    });
  });

  it("is ready with every variable, trimmed", () => {
    expect(readAuthConfig({ AUTH_SECRET: " s ", AUTH_GOOGLE_ID: "id", AUTH_GOOGLE_SECRET: "gs" })).toEqual({
      state: "ready",
      secret: "s",
      googleClientId: "id",
      googleClientSecret: "gs",
    });
  });
});

describe("decideAccess", () => {
  it("allows everything in local mode", () => {
    expect(decideAccess({ pathname: "/portfolio", mode: "off", signedIn: false })).toEqual({ action: "allow" });
  });

  it("redirects signed-out page requests to sign-in and keeps the destination", () => {
    expect(decideAccess({ pathname: "/resumes/r1", search: "?x=1", mode: "ready", signedIn: false })).toEqual({
      action: "redirect",
      to: "/sign-in?callbackUrl=%2Fresumes%2Fr1%3Fx%3D1",
    });
  });

  it("answers 401 for signed-out API requests instead of redirecting", () => {
    expect(decideAccess({ pathname: "/api/anything", mode: "ready", signedIn: false })).toEqual({ action: "deny" });
  });

  it("allows signed-in requests", () => {
    expect(decideAccess({ pathname: "/", mode: "ready", signedIn: true })).toEqual({ action: "allow" });
  });

  it("blocks the app when the configuration is incomplete, even with a cookie", () => {
    expect(decideAccess({ pathname: "/", mode: "incomplete", signedIn: true })).toEqual({
      action: "redirect",
      to: "/sign-in",
    });
    expect(decideAccess({ pathname: "/api/x", mode: "incomplete", signedIn: false })).toEqual({ action: "deny" });
  });

  it("keeps sign-in, Auth.js, and account status reachable without a session", () => {
    for (const pathname of ["/sign-in", "/api/auth/callback/google", "/api/auth/session", "/api/account"]) {
      expect(isPublicPath(pathname)).toBe(true);
      expect(decideAccess({ pathname, mode: "ready", signedIn: false })).toEqual({ action: "allow" });
    }
  });

  it("doesn't treat look-alike paths as public", () => {
    for (const pathname of ["/sign-inx", "/api/accounts", "/api/authx", "/api/auth"]) {
      expect(isPublicPath(pathname)).toBe(false);
    }
  });
});

describe("safeCallbackPath", () => {
  it("keeps same-site paths", () => {
    expect(safeCallbackPath("/resumes/r1?tab=2")).toBe("/resumes/r1?tab=2");
  });

  it("rejects other sites, odd values, and the sign-in page itself", () => {
    for (const value of ["https://evil.example.com", "//evil.example.com", "/\\evil.example.com", "", null, 3, "/sign-in", "/sign-in?callbackUrl=/"]) {
      expect(safeCallbackPath(value)).toBe("/");
    }
  });
});

describe("account state", () => {
  const signedIn = { status: "signed_in", user: { id: "google:123", name: "Sam Rivera", email: "sam@example.com" } } as const;

  it("validates the server's answer strictly", () => {
    expect(accountStateSchema.safeParse(signedIn).success).toBe(true);
    expect(accountStateSchema.safeParse({ ...signedIn, token: "x" }).success).toBe(false);
    expect(accountStateSchema.safeParse({ status: "signed_in", user: { id: "", name: null, email: null } }).success).toBe(false);
    expect(accountStateSchema.safeParse({ status: "admin" }).success).toBe(false);
  });

  it("opens a workspace only for local mode or a signed-in account", () => {
    expect(workspaceScopeOf({ status: "local" })).toEqual({ kind: "local" });
    expect(workspaceScopeOf(signedIn)).toEqual({ kind: "account", accountId: "google:123" });
    expect(workspaceScopeOf({ status: "signed_out" })).toBeNull();
    expect(workspaceScopeOf({ status: "unavailable" })).toBeNull();
  });

  it("round-trips scope keys, including ids with colons", () => {
    const scope = { kind: "account", accountId: "google:123" } as const;
    expect(scopeFromKey(scopeKey(scope))).toEqual(scope);
    expect(scopeFromKey(scopeKey({ kind: "local" }))).toEqual({ kind: "local" });
  });

  it("derives initials from the name or email only", () => {
    expect(initialsOf(signedIn.user)).toBe("SR");
    expect(initialsOf({ id: "x", name: null, email: "dev@example.com" })).toBe("D");
    expect(initialsOf({ id: "x", name: "Ada", email: null })).toBe("A");
    expect(initialsOf({ id: "x", name: null, email: null })).toBe("?");
  });
});

describe("signInErrorMessage", () => {
  it("maps Auth.js codes to plain messages and never echoes unknown codes", () => {
    expect(signInErrorMessage(undefined)).toBeNull();
    expect(signInErrorMessage("AccessDenied")).toMatch(/cancelled or access was denied/);
    expect(signInErrorMessage("<script>")).not.toContain("<script>");
  });
});
