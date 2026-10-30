"use client";

import { useCallback, useState } from "react";
import { signOutOfAccount } from "@/lib/auth/actions";
import { SIGN_IN_PATH } from "@/lib/auth/access";
import { useToast } from "@/components/ui/toast";
import { fetchAccountState } from "./account-provider";

/**
 * Signs out, then loads the sign-in page with a full navigation so the
 * signed-out tab keeps no workspace in memory. The workspace stays in this
 * browser under the account's own key (D-030).
 */
export function useSignOut() {
  const { notify } = useToast();
  const [pending, setPending] = useState(false);

  const signOut = useCallback(async () => {
    setPending(true);
    try {
      await signOutOfAccount();
      window.location.assign(SIGN_IN_PATH);
    } catch {
      // The action also fails when the session had already expired; check before reporting an error.
      const account = await fetchAccountState();
      if (account.phase === "ready" && account.state.status !== "signed_in") {
        window.location.assign(SIGN_IN_PATH);
        return;
      }
      setPending(false);
      notify({ tone: "error", title: "You're still signed in", description: "Signing out didn't work. Try again." });
    }
  }, [notify]);

  return { signOut, pending };
}
