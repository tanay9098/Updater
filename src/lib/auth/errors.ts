/**
 * Messages for the `error` query parameter Auth.js adds when it sends the
 * user back to the sign-in page. Unknown codes get a generic message; the
 * raw code is never shown.
 */
export function signInErrorMessage(code: string | undefined): string | null {
  if (!code) return null;
  switch (code) {
    case "AccessDenied":
      return "Google sign-in was cancelled or access was denied. You can try again.";
    case "Configuration":
      return "Sign-in failed because of a server configuration problem. Try again later.";
    default:
      return "Something went wrong while signing in with Google. Try again.";
  }
}
