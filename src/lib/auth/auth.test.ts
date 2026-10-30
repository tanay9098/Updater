import { describe, expect, it } from "vitest";
import { decideAccess, isPublicPath, safeCallbackPath } from "./access";
import { accountStateSchema, initialsOf, workspaceScopeOf } from "./account";
import { readAuthConfig } from "./config";
import { signInErrorMessage } from "./errors";
import { isSessionRefresh, withoutSessionRefresh } from "./session-cookies";

describe("readAuthConfig", () => {
  it("has no mode without sign-in: nothing set means everything is missing", () => {
    expect(readAuthConfig({})).toEqual({ state: "missing", missing: ["AUTH_SECRET", "AUTH_GOOGLE_ID", "AUTH_GOOGLE_SECRET"] });
    expect(readAuthConfig({ AUTH_SECRET: "  ", AUTH_GOOGLE_ID: "" }).state).toBe("missing");
  });

  it("lists exactly what is missing when part of the configuration is set", () => {
    expect(readAuthConfig({ AUTH_GOOGLE_ID: "id" })).toEqual({
      state: "missing",
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

  it("blocks the app when sign-in isn't configured, even with a cookie", () => {
    expect(decideAccess({ pathname: "/", mode: "missing", signedIn: true })).toEqual({
      action: "redirect",
      to: "/sign-in",
    });
    expect(decideAccess({ pathname: "/api/x", mode: "missing", signedIn: false })).toEqual({ action: "deny" });
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

  it("opens a workspace only for a signed-in account", () => {
    expect(accountStateSchema.safeParse({ status: "local" }).success).toBe(false);
    expect(workspaceScopeOf(signedIn)).toEqual({ kind: "account", accountId: "google:123" });
    expect(workspaceScopeOf({ status: "signed_out" })).toBeNull();
    expect(workspaceScopeOf({ status: "unavailable" })).toBeNull();
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

describe("withoutSessionRefresh", () => {
  const headersWith = (...cookies: string[]) => {
    const headers = new Headers();
    for (const cookie of cookies) headers.append("set-cookie", cookie);
    return headers;
  };

  it("recognizes session-token writes, including the secure variant and chunks", () => {
    for (const cookie of [
      "authjs.session-token=abc; Path=/; HttpOnly",
      "__Secure-authjs.session-token=abc; Path=/; Secure",
      "authjs.session-token.0=abc; Path=/",
    ]) {
      expect(isSessionRefresh(cookie)).toBe(true);
    }
    for (const cookie of [
      "authjs.session-token=; Path=/; Max-Age=0",
      "authjs.csrf-token=x",
      "authjs.callback-url=x",
      "authjs.session-tokenx=1",
      "other=authjs.session-token=1",
    ]) {
      expect(isSessionRefresh(cookie)).toBe(false);
    }
  });

  it("drops session-cookie writes and keeps every other cookie", () => {
    const headers = headersWith(
      "authjs.csrf-token=c; Path=/",
      "authjs.session-token=refreshed; Path=/; HttpOnly",
      "authjs.callback-url=u; Path=/",
    );
    withoutSessionRefresh(headers);
    expect(headers.getSetCookie()).toEqual(["authjs.csrf-token=c; Path=/", "authjs.callback-url=u; Path=/"]);
  });

  it("keeps Auth.js deleting an unreadable session cookie", () => {
    const headers = headersWith("authjs.session-token=; Path=/; Max-Age=0");
    withoutSessionRefresh(headers);
    expect(headers.getSetCookie()).toEqual(["authjs.session-token=; Path=/; Max-Age=0"]);
  });

  it("leaves responses without a session cookie untouched", () => {
    const headers = headersWith("a=1");
    headers.set("x-other", "kept");
    withoutSessionRefresh(headers);
    expect(headers.getSetCookie()).toEqual(["a=1"]);
    expect(headers.get("x-other")).toBe("kept");
  });
});
