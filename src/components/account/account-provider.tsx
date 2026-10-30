"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { accountStateSchema, type AccountState } from "@/lib/auth/account";

/**
 * Who is signed in, as reported by the server (`/api/account`). Pages stay
 * static; the account is read after hydration, and again whenever the tab
 * becomes visible, so signing out in another tab closes this one's workspace.
 */

export type AccountSnapshot =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "ready"; state: AccountState };

type AccountContextValue = { snapshot: AccountSnapshot; refresh: () => void };

const AccountContext = createContext<AccountContextValue | null>(null);

const LOADING: AccountSnapshot = { phase: "loading" };

export async function fetchAccountState(): Promise<AccountSnapshot> {
  try {
    const response = await fetch("/api/account", { cache: "no-store", credentials: "same-origin" });
    if (!response.ok) return { phase: "error", message: `The server answered ${response.status}.` };
    const parsed = accountStateSchema.safeParse(await response.json());
    return parsed.success
      ? { phase: "ready", state: parsed.data }
      : { phase: "error", message: "The server's answer wasn't understood." };
  } catch {
    return { phase: "error", message: "The server couldn't be reached." };
  }
}

export function AccountProvider({
  children,
  initial,
  load = fetchAccountState,
}: {
  children: ReactNode;
  /** A known state (tests). When given, nothing is fetched. */
  initial?: AccountState;
  load?: () => Promise<AccountSnapshot>;
}) {
  const [snapshot, setSnapshot] = useState<AccountSnapshot>(() =>
    initial ? { phase: "ready", state: initial } : LOADING,
  );

  const refresh = useCallback(() => {
    if (initial) return;
    void load().then((next) =>
      setSnapshot((current) =>
        // Keep the current object when nothing changed, so consumers don't re-render.
        JSON.stringify(current) === JSON.stringify(next) ? current : next,
      ),
    );
  }, [initial, load]);

  useEffect(() => {
    refresh();
    function onVisibility() {
      if (document.visibilityState === "visible") refresh();
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [refresh]);

  const value = useMemo(() => ({ snapshot, refresh }), [snapshot, refresh]);
  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

/** The account snapshot. Outside a provider it stays "loading", so no workspace is ever opened by default. */
export function useAccount(): AccountContextValue {
  return useContext(AccountContext) ?? { snapshot: LOADING, refresh: () => {} };
}
