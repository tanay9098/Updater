import { NextResponse, type NextRequest } from "next/server";
import { siteAnswer } from "@/lib/publishers/github-pages/handlers";
import { LINK_COOKIE, cookieOptions } from "@/lib/publishers/github-pages/link-cookie";
import { NO_STORE, handlerDeps, isSameOrigin, isSecure, linkFor, requireAccount } from "@/lib/publishers/github-pages/server";

/**
 * The developer's GitHub Pages site as GitHub reports it right now (T10.9):
 * not linked, app not installed, repository missing, or ready with its
 * Pages settings. Read-only; nothing is stored on the server.
 */
export async function GET(request: NextRequest) {
  const account = await requireAccount();
  if (account instanceof Response) return account;
  const { status, body } = await siteAnswer(handlerDeps(), await linkFor(request, account));
  return Response.json(body, { status, headers: NO_STORE });
}

/**
 * Forgets the linked GitHub account in this browser. The app stays
 * installed on GitHub until the developer removes it there, and the
 * published site stays in their repository.
 */
export async function DELETE(request: NextRequest) {
  const account = await requireAccount();
  if (account instanceof Response) return account;
  if (!isSameOrigin(request)) {
    return Response.json({ error: "Requests must come from Updater's own pages." }, { status: 403, headers: NO_STORE });
  }
  const { status, body } = await siteAnswer(handlerDeps(), null);
  const response = NextResponse.json(body, { status, headers: NO_STORE });
  response.cookies.set(LINK_COOKIE, "", cookieOptions(isSecure(request), "/", 0));
  return response;
}
