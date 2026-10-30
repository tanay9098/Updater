import { z } from "zod";

/**
 * What `/api/account` reports to the browser (architecture.md §10). The
 * server is the only authority on who is signed in; the browser validates
 * the response like any other external input (rules.md §7.3.5).
 */

export const accountStateSchema = z.discriminatedUnion("status", [
  /** Sign-in isn't configured: one local workspace, no account. */
  z.strictObject({ status: z.literal("local") }),
  /** Sign-in is configured but incomplete, so nobody can use the app. */
  z.strictObject({ status: z.literal("unavailable") }),
  z.strictObject({ status: z.literal("signed_out") }),
  z.strictObject({
    status: z.literal("signed_in"),
    user: z.strictObject({
      id: z.string().min(1).max(200),
      name: z.string().max(200).nullable(),
      email: z.string().max(320).nullable(),
    }),
  }),
]);

export type AccountState = z.infer<typeof accountStateSchema>;
export type AccountUser = Extract<AccountState, { status: "signed_in" }>["user"];

/** Identifies whose workspace is in use. Local mode keeps the unscoped pre-sign-in workspace. */
export type WorkspaceScope = { kind: "local" } | { kind: "account"; accountId: string };

export function workspaceScopeOf(state: AccountState): WorkspaceScope | null {
  if (state.status === "local") return { kind: "local" };
  if (state.status === "signed_in") return { kind: "account", accountId: state.user.id };
  return null;
}

/** A string form of the scope, for memo keys and React keys. */
export function scopeKey(scope: WorkspaceScope): string {
  return scope.kind === "local" ? "local" : `account:${scope.accountId}`;
}

export function scopeFromKey(key: string): WorkspaceScope {
  return key.startsWith("account:") ? { kind: "account", accountId: key.slice("account:".length) } : { kind: "local" };
}

/** Up to two initials for the account button, from the name (or the email's first letter). Never invents a name. */
export function initialsOf(user: AccountUser): string {
  const words = (user.name ?? "").split(/\s+/).filter(Boolean);
  if (words.length > 0) {
    const picked = words.length > 1 ? [words[0], words[words.length - 1]] : words;
    return picked.map((word) => word.charAt(0).toUpperCase()).join("");
  }
  return user.email?.trim().charAt(0).toUpperCase() || "?";
}
