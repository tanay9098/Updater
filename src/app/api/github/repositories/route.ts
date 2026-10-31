import type { NextRequest } from "next/server";
import { auth, authConfig } from "@/auth";
import { repositoriesResponse } from "@/lib/providers/github/repositories";

/**
 * Lists a GitHub account's public repositories for import (T10.1,
 * architecture.md §8.1, §9). Read-only. The optional `GITHUB_TOKEN` raises
 * GitHub's rate limit; it is read here, on the server, and never sent to
 * the browser. Nothing is stored on the server: the browser decides what to
 * import and keeps it in the signed-in account's workspace.
 */
export async function GET(request: NextRequest) {
  const noStore = { "Cache-Control": "private, no-store" };
  // The proxy already requires a session for /api/*; checking again here keeps the route safe on its own.
  if (authConfig.state !== "ready") {
    return Response.json({ error: "Sign-in isn't configured." }, { status: 503, headers: noStore });
  }
  const session = await auth();
  if (!session?.accountId) return Response.json({ error: "Sign in required." }, { status: 401, headers: noStore });

  const { status, body } = await repositoriesResponse(request.nextUrl.searchParams, {
    fetch,
    token: process.env.GITHUB_TOKEN,
  });
  return Response.json(body, { status, headers: noStore });
}
