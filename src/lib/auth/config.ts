/**
 * Sign-in configuration (architecture.md §10, D-029). Pure: it only reads
 * the environment object it is given, so it can be tested without a server.
 *
 * - `off`: none of the variables is set. Updater runs in local mode with one
 *   unscoped workspace in the browser, so local development never needs
 *   third-party credentials (rules.md §7.5.6).
 * - `ready`: all variables are set. Every page requires a Google sign-in and
 *   each account gets its own workspace.
 * - `incomplete`: some are set. Sign-in was clearly intended, so access fails
 *   closed instead of silently falling back to local mode.
 */

export const AUTH_ENV_VARS = ["AUTH_SECRET", "AUTH_GOOGLE_ID", "AUTH_GOOGLE_SECRET"] as const;

type AuthEnvVar = (typeof AUTH_ENV_VARS)[number];
export type AuthEnv = Partial<Record<AuthEnvVar, string | undefined>>;

export type AuthConfig =
  | { state: "off" }
  | { state: "incomplete"; missing: AuthEnvVar[] }
  | { state: "ready"; secret: string; googleClientId: string; googleClientSecret: string };

export type AuthMode = AuthConfig["state"];

export function readAuthConfig(env: AuthEnv): AuthConfig {
  const value = (name: AuthEnvVar) => env[name]?.trim() || undefined;
  const missing = AUTH_ENV_VARS.filter((name) => !value(name));
  if (missing.length === AUTH_ENV_VARS.length) return { state: "off" };
  if (missing.length > 0) return { state: "incomplete", missing };
  return {
    state: "ready",
    secret: value("AUTH_SECRET")!,
    googleClientId: value("AUTH_GOOGLE_ID")!,
    googleClientSecret: value("AUTH_GOOGLE_SECRET")!,
  };
}
