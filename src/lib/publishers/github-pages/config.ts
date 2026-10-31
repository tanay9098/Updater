/**
 * GitHub App configuration for publishing (T10.9, D-037). Pure: it reads
 * only the environment object it is given.
 *
 * Publishing is optional (rules.md §7.5.5): with any variable unset the
 * Portfolio page says publishing isn't set up on this server, and the rest
 * of the app works as before.
 */

export const GITHUB_APP_ENV_VARS = [
  "GITHUB_APP_ID",
  "GITHUB_APP_SLUG",
  "GITHUB_APP_CLIENT_ID",
  "GITHUB_APP_CLIENT_SECRET",
  "GITHUB_APP_PRIVATE_KEY",
] as const;

type GithubAppEnvVar = (typeof GITHUB_APP_ENV_VARS)[number];
export type GithubAppEnv = Partial<Record<GithubAppEnvVar, string | undefined>>;

export type GithubAppConfig =
  | { state: "missing"; missing: GithubAppEnvVar[] }
  | { state: "invalid"; problem: string }
  | { state: "ready"; appId: string; slug: string; clientId: string; clientSecret: string; privateKey: string };

export function readGithubAppConfig(env: GithubAppEnv): GithubAppConfig {
  const value = (name: GithubAppEnvVar) => env[name]?.trim() || undefined;
  const missing = GITHUB_APP_ENV_VARS.filter((name) => !value(name));
  if (missing.length > 0) return { state: "missing", missing };

  const appId = value("GITHUB_APP_ID")!;
  const slug = value("GITHUB_APP_SLUG")!;
  // Hosting dashboards often store a PEM on one line with literal "\n" sequences.
  const privateKey = value("GITHUB_APP_PRIVATE_KEY")!.replace(/\\n/g, "\n");
  if (!/^\d{1,12}$/.test(appId)) return { state: "invalid", problem: "GITHUB_APP_ID must be the app's numeric ID." };
  if (!/^[a-z0-9](?:[a-z0-9-]{0,98}[a-z0-9])?$/.test(slug)) {
    return { state: "invalid", problem: "GITHUB_APP_SLUG must be the app's URL name, as in github.com/apps/<slug>." };
  }
  if (!/-----BEGIN (?:RSA )?PRIVATE KEY-----/.test(privateKey)) {
    return { state: "invalid", problem: "GITHUB_APP_PRIVATE_KEY must be the app's private key in PEM format." };
  }
  return {
    state: "ready",
    appId,
    slug,
    clientId: value("GITHUB_APP_CLIENT_ID")!,
    clientSecret: value("GITHUB_APP_CLIENT_SECRET")!,
    privateKey,
  };
}

/** Where a developer installs the app and chooses which repository it may use. */
export function installUrl(slug: string): string {
  return `https://github.com/apps/${encodeURIComponent(slug)}/installations/new`;
}
