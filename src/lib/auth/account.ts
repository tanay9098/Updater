import { z } from "zod";

/**
 * What `/api/account` reports to the browser (architecture.md §10). The
 * server is the only authority on who is signed in; the browser validates
 * the response like any other external input (rules.md §7.3.5).
 */

export const accountStateSchema = z.discriminatedUnion("status", [
  /** Sign-in isn't configured on the server, so nobody can use the app. */
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

/** Identifies whose workspace is in use. Every workspace belongs to a signed-in account (D-031). */
export type WorkspaceScope = { kind: "account"; accountId: string };

export function workspaceScopeOf(state: AccountState): WorkspaceScope | null {
  return state.status === "signed_in" ? { kind: "account", accountId: state.user.id } : null;
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
