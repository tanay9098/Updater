"use server";

import { redirect } from "next/navigation";
import { authConfig, signIn, signOut } from "@/auth";
import { SIGN_IN_PATH, safeCallbackPath } from "./access";

/** Starts the Google sign-in. The first sign-in creates the account; there is no separate sign-up. */
export async function signInWithGoogle(formData: FormData): Promise<void> {
  if (authConfig.state !== "ready") redirect(SIGN_IN_PATH);
  // Throws Next.js's redirect to Google; Auth.js validates state and PKCE on the callback.
  await signIn("google", { redirectTo: safeCallbackPath(formData.get("callbackUrl")) });
}

/**
 * Clears the session cookie. The caller then loads the sign-in page with a
 * full navigation, so no workspace stays in this tab's memory.
 */
export async function signOutOfAccount(): Promise<void> {
  if (authConfig.state !== "ready") return;
  await signOut({ redirect: false });
}
