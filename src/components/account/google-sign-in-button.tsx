"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

/** Submit button for the Google sign-in form; busy while the redirect to Google starts. */
export function GoogleSignInButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" loading={pending} className="w-full">
      Continue with Google
    </Button>
  );
}
