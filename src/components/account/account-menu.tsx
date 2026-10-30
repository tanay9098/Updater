"use client";

import Link from "next/link";
import { LogOut, Settings } from "lucide-react";
import { initialsOf } from "@/lib/auth/account";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { useAccount } from "./account-provider";
import { useSignOut } from "./use-sign-out";

/** Top-bar account button (design.md §4). Renders nothing in local mode or while signed out. */
export function AccountMenu() {
  const { snapshot } = useAccount();
  const { signOut, pending } = useSignOut();
  if (snapshot.phase !== "ready" || snapshot.state.status !== "signed_in") return null;
  const { user } = snapshot.state;
  const label = user.name ?? user.email ?? "your account";

  return (
    <Menu>
      <MenuTrigger
        aria-label={`Account: ${label}`}
        className="inline-flex size-9 items-center justify-center rounded-full border border-border-strong bg-control text-meta font-semibold text-foreground hover:bg-control-hover"
      >
        <span aria-hidden="true">{initialsOf(user)}</span>
      </MenuTrigger>
      <MenuContent className="min-w-56">
        <div className="flex flex-col px-2 py-1.5">
          <span className="truncate text-label font-medium">{user.name ?? "Signed in"}</span>
          {user.email ? <span className="truncate text-meta text-muted">{user.email}</span> : null}
        </div>
        <MenuSeparator />
        <MenuItem asChild>
          <Link href="/settings#account">
            <Settings aria-hidden="true" size={16} strokeWidth={1.75} />
            Account settings
          </Link>
        </MenuItem>
        <MenuItem disabled={pending} onSelect={() => void signOut()}>
          <LogOut aria-hidden="true" size={16} strokeWidth={1.75} />
          {pending ? "Signing out…" : "Sign out"}
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}
