import type { NextRequest } from "next/server";
import { buildStatusAnswer } from "@/lib/publishers/github-pages/handlers";
import { NO_STORE, handlerDeps, linkFor, requireAccount } from "@/lib/publishers/github-pages/server";

/**
 * Whether GitHub Pages built the commit Updater published (T10.9). The
 * browser records the site as published only after this answers `built`
 * for that commit (rules.md §7.1.9).
 */
export async function GET(request: NextRequest) {
  const account = await requireAccount();
  if (account instanceof Response) return account;
  const { status, body } = await buildStatusAnswer(
    handlerDeps(),
    await linkFor(request, account),
    request.nextUrl.searchParams.get("commit"),
  );
  return Response.json(body, { status, headers: NO_STORE });
}
