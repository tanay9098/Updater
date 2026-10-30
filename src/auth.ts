import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { readAuthConfig } from "@/lib/auth/config";
import { SIGN_IN_PATH } from "@/lib/auth/access";

/**
 * Auth.js setup (architecture.md §10, D-029). Server-only: imported by the
 * proxy, route handlers, and server actions, never by client components.
 *
 * Sessions are encrypted JWTs in an HTTP-only cookie managed by Auth.js; no
 * token reaches browser storage (rules.md §7.3.4). There is no user
 * database: an account is the Google identity, and its id is the stable
 * provider account id (`google:<sub>`), which scopes the workspace.
 */

export const authConfig = readAuthConfig({
  AUTH_SECRET: process.env.AUTH_SECRET,
  AUTH_GOOGLE_ID: process.env.AUTH_GOOGLE_ID,
  AUTH_GOOGLE_SECRET: process.env.AUTH_GOOGLE_SECRET,
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers:
    authConfig.state === "ready"
      ? [
          Google({
            clientId: authConfig.googleClientId,
            clientSecret: authConfig.googleClientSecret,
            // Auth.js checks PKCE by default; `state` is verified on the callback too (architecture.md §9).
            checks: ["pkce", "state"],
          }),
        ]
      : [],
  secret: authConfig.state === "ready" ? authConfig.secret : undefined,
  session: { strategy: "jwt" },
  pages: { signIn: SIGN_IN_PATH, error: SIGN_IN_PATH },
  callbacks: {
    jwt({ token, account }) {
      // `account` is only present on the sign-in request itself.
      if (account) token.accountId = `${account.provider}:${account.providerAccountId}`;
      // The avatar URL isn't used; don't carry it in the cookie (rules.md §7.3.10).
      delete token.picture;
      return token;
    },
    session({ session, token }) {
      session.accountId = typeof token.accountId === "string" ? token.accountId : undefined;
      return session;
    },
  },
});

declare module "next-auth" {
  interface Session {
    /** Stable account id (`google:<sub>`). Missing only for a malformed token. */
    accountId?: string;
  }
}
