import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import type { NextAuthRequest } from "next-auth";
import { auth, authConfig } from "@/auth";
import { decideAccess } from "@/lib/auth/access";

/**
 * Server-side sign-in gate on every request (architecture.md §10, T10.5).
 * The rules live in `decideAccess`; this file only connects them to Auth.js.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- the event parameter makes Auth.js's types pick its proxy overload, not the route-handler one
function withSession(request: NextAuthRequest, event: NextFetchEvent) {
  const decision = decideAccess({
    pathname: request.nextUrl.pathname,
    search: request.nextUrl.search,
    mode: authConfig.state,
    signedIn: Boolean(request.auth?.accountId),
  });
  if (decision.action === "allow") return NextResponse.next();
  if (decision.action === "deny") return Response.json({ error: "Sign in required." }, { status: 401 });
  return NextResponse.redirect(new URL(decision.to, request.nextUrl.origin));
}
const guarded = auth(withSession);

export default function proxy(request: NextRequest, event: NextFetchEvent) {
  if (authConfig.state === "ready") return guarded(request, event);
  const decision = decideAccess({ pathname: request.nextUrl.pathname, mode: authConfig.state, signedIn: false });
  if (decision.action === "allow") return NextResponse.next();
  if (decision.action === "deny") return Response.json({ error: "Sign-in isn't fully configured." }, { status: 503 });
  return NextResponse.redirect(new URL(decision.to, request.nextUrl.origin));
}

export const config = {
  // Everything except build assets and the app icon (proxy.md: negative matching).
  matcher: ["/((?!_next/static|_next/image|icon.svg|favicon.ico).*)"],
};
