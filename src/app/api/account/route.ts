import { connection } from "next/server";
import { auth, authConfig } from "@/auth";
import type { AccountState } from "@/lib/auth/account";

/**
 * Who is using the app, as the server sees it (architecture.md §10). The
 * browser chooses the workspace from this answer, so it is read from the
 * session cookie on every request and never cached.
 */
export async function GET() {
  // Without this, the "unavailable" answer reads no request data and would be prerendered at build time.
  await connection();
  return Response.json(await accountState(), { headers: { "Cache-Control": "private, no-store" } });
}

async function accountState(): Promise<AccountState> {
  if (authConfig.state === "missing") return { status: "unavailable" };
  const session = await auth();
  if (!session?.accountId) return { status: "signed_out" };
  return {
    status: "signed_in",
    user: { id: session.accountId, name: session.user?.name ?? null, email: session.user?.email ?? null },
  };
}
