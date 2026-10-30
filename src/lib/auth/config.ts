/**
 * Sign-in configuration (architecture.md §10, D-031). Pure: it only reads
 * the environment object it is given, so it can be tested without a server.
 *
 * Google sign-in is compulsory: there is no mode without an account.
 *
 * - `ready`: all variables are set. Every page requires a Google sign-in and
 *   each account gets its own workspace.
 * - `missing`: at least one is unset. Nobody can sign in, so the app is
 *   blocked and the sign-in page explains why. It never falls back to an
 *   unauthenticated mode.
 */

export const AUTH_ENV_VARS = ["AUTH_SECRET", "AUTH_GOOGLE_ID", "AUTH_GOOGLE_SECRET"] as const;

type AuthEnvVar = (typeof AUTH_ENV_VARS)[number];
export type AuthEnv = Partial<Record<AuthEnvVar, string | undefined>>;

export type AuthConfig =
  | { state: "missing"; missing: AuthEnvVar[] }
  | { state: "ready"; secret: string; googleClientId: string; googleClientSecret: string };

export type AuthMode = AuthConfig["state"];

export function readAuthConfig(env: AuthEnv): AuthConfig {
  const value = (name: AuthEnvVar) => env[name]?.trim() || undefined;
  const missing = AUTH_ENV_VARS.filter((name) => !value(name));
  if (missing.length > 0) return { state: "missing", missing };
  return {
    state: "ready",
    secret: value("AUTH_SECRET")!,
    googleClientId: value("AUTH_GOOGLE_ID")!,
    googleClientSecret: value("AUTH_GOOGLE_SECRET")!,
  };
}
