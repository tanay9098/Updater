"use client";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SIGN_IN_PATH } from "@/lib/auth/access";
import { useAccount } from "./account-provider";

/**
 * Shown instead of the workspace when no account may open it: signed out
 * (for example in another tab), sign-in misconfigured, or the account
 * couldn't be checked. It never falls back to another workspace.
 */
export function AccountRequired({
  reason,
  message,
}: {
  reason: "signed_out" | "unavailable" | "error";
  message?: string;
}) {
  const { refresh } = useAccount();

  if (reason === "error") {
    return (
      <div className="flex max-w-2xl flex-col gap-4">
        <Alert tone="error" title="Your sign-in couldn't be checked">
          {message} Your workspace stays closed until Updater can confirm who is signed in.
        </Alert>
        <div>
          <Button variant="secondary" onClick={refresh}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  if (reason === "unavailable") {
    return (
      <EmptyState
        title="Sign-in isn't available"
        description="Sign-in is turned on for this installation but isn't fully configured, so workspaces can't be opened. Ask the person who runs it to finish the setup."
      />
    );
  }

  return (
    <EmptyState
      title="You're signed out"
      description="Sign in with Google to open your workspace. Each account has its own portfolio and resumes."
      action={
        <Button asChild variant="primary">
          {/* A full page load, so nothing from the previous session stays in memory. */}
          <a href={SIGN_IN_PATH}>Sign in</a>
        </Button>
      }
    />
  );
}
