/**
 * Auth.js re-encodes the session cookie on every request it reads (sliding
 * expiry for JWT sessions) and the proxy wrapper attaches it to every
 * response, including background route prefetches. A response that arrives
 * after the cookie changed, because the user signed out or another account
 * signed in, would then put the old session back (found in Phase D).
 *
 * So the sign-in gate never re-issues the session. It still passes on
 * Auth.js clearing an unreadable cookie: a late deletion can only sign
 * someone out, never in. The session cookie is set by the Google callback
 * and cleared by sign-out; it lasts Auth.js's `maxAge` from sign-in
 * (architecture.md §10).
 */

/** `authjs.session-token`, its `__Secure-` variant on https, and chunks (`.0`, `.1`, …) for large tokens, with a value. */
const SESSION_COOKIE_WITH_VALUE = /^(?:__Secure-)?authjs\.session-token(?:\.\d+)?=[^;\s]/;

/** True when a `Set-Cookie` value writes a session token (not when it deletes one). */
export function isSessionRefresh(setCookie: string): boolean {
  return SESSION_COOKIE_WITH_VALUE.test(setCookie.trimStart());
}

/** Removes session-token writes from a response's headers, keeping deletions and every other cookie. */
export function withoutSessionRefresh(headers: Headers): void {
  const cookies = headers.getSetCookie();
  if (!cookies.some(isSessionRefresh)) return;
  headers.delete("set-cookie");
  for (const cookie of cookies) {
    if (!isSessionRefresh(cookie)) headers.append("set-cookie", cookie);
  }
}
