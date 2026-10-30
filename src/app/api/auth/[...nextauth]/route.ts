import type { NextRequest } from "next/server";
import { authConfig, handlers } from "@/auth";

/**
 * Auth.js endpoints (sign-in redirect, OAuth callback, session, sign-out).
 * In local mode there is nothing to serve, so the endpoints don't exist.
 */
function notConfigured() {
  return Response.json({ error: "Sign-in isn't configured." }, { status: 404 });
}

export function GET(request: NextRequest) {
  return authConfig.state === "ready" ? handlers.GET(request) : notConfigured();
}

export function POST(request: NextRequest) {
  return authConfig.state === "ready" ? handlers.POST(request) : notConfigured();
}
