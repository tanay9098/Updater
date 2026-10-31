"use client";

import { Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CALLBACK_OUTCOMES, type CallbackOutcome } from "@/lib/publishers/github-pages/contract";
import { Alert, type AlertTone } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

const NOTICES: Record<CallbackOutcome, { tone: AlertTone; title: string; text: string }> = {
  linked: {
    tone: "success",
    title: "GitHub connected",
    text: "Updater knows which GitHub account is yours. It didn't keep any GitHub password or token.",
  },
  denied: { tone: "warning", title: "GitHub wasn't connected", text: "The authorization was cancelled on GitHub. Nothing changed." },
  invalid: {
    tone: "error",
    title: "GitHub wasn't connected",
    text: "The connection request expired or didn't match this session. Choose “Connect GitHub” again.",
  },
  failed: { tone: "error", title: "GitHub wasn't connected", text: "GitHub didn't confirm the connection. Try again in a moment." },
  unavailable: { tone: "info", title: "Publishing isn't set up on this server", text: "Nothing was connected." },
};

function isOutcome(value: string | null): value is CallbackOutcome {
  return value !== null && (CALLBACK_OUTCOMES as ReadonlyArray<string>).includes(value);
}

/**
 * The result of "Connect GitHub", shown after GitHub's callback sends the
 * developer back to `/portfolio?github=<outcome>` (T10.9). Search params are
 * request data, so this reads them inside its own Suspense boundary (D-028).
 */
export function GithubCallbackNotice() {
  return (
    <Suspense fallback={null}>
      <Notice />
    </Suspense>
  );
}

function Notice() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const outcome = params.get("github");
  if (!isOutcome(outcome)) return null;
  const notice = NOTICES[outcome];
  return (
    <Alert
      tone={notice.tone}
      title={notice.title}
      action={
        <Button size="sm" variant="ghost" onClick={() => router.replace(pathname)}>
          Dismiss
        </Button>
      }
    >
      {notice.text}
    </Alert>
  );
}
