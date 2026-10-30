import { Suspense, type ReactNode } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth, authConfig } from "@/auth";
import { ProductMark } from "@/components/layout/product-mark";
import { GoogleSignInButton } from "@/components/account/google-sign-in-button";
import { Alert } from "@/components/ui/alert";
import { LoadingState, Skeleton } from "@/components/ui/skeleton";
import { safeCallbackPath } from "@/lib/auth/access";
import { signInWithGoogle } from "@/lib/auth/actions";
import { signInErrorMessage } from "@/lib/auth/errors";

export const metadata: Metadata = { title: "Sign in" };

/**
 * Sign-in and sign-up (design.md §4). A Google sign-in is required to use
 * Updater (D-031); the first sign-in creates the account. The page sits outside the app shell, and its
 * request-time part streams in behind Suspense (Cache Components).
 */
export default function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  return (
    <main id="main-content" className="flex min-h-dvh items-start justify-center px-4 py-12 sm:items-center">
      <div className="flex w-full max-w-md flex-col gap-6">
        <ProductMark />
        <Suspense
          fallback={
            <LoadingState label="Checking sign-in…" className="flex flex-col gap-3">
              <Skeleton className="h-8 w-2/3" />
              <Skeleton className="h-24 w-full" />
            </LoadingState>
          }
        >
          <SignInContent searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

async function SignInContent({ searchParams }: { searchParams: PageProps<"/sign-in">["searchParams"] }) {
  const params = await searchParams;
  const callbackUrl = safeCallbackPath(first(params.callbackUrl));

  if (authConfig.state === "missing") {
    return (
      <Card
        title="Sign-in isn't available"
        description="Updater requires a Google sign-in, but this server isn't configured for it yet, so nobody can sign in."
      >
        {/* Which variables are missing is only shown in development, not to every visitor. */}
        {process.env.NODE_ENV !== "production" ? (
          <Alert tone="warning" title="Missing configuration">
            Set {authConfig.missing.join(", ")} (see <code>.env.example</code>), then restart the server.
          </Alert>
        ) : null}
      </Card>
    );
  }

  const session = await auth();
  if (session?.accountId) redirect(callbackUrl);
  const error = signInErrorMessage(first(params.error));

  return (
    <Card
      title="Sign in to Updater"
      description="New here? Continuing with Google creates your Updater account the first time."
    >
      {error ? (
        <Alert tone="error" title="Sign-in didn't complete">
          {error}
        </Alert>
      ) : null}
      <form action={signInWithGoogle}>
        <input type="hidden" name="callbackUrl" value={callbackUrl} />
        <GoogleSignInButton />
      </form>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-support text-muted">
        <li>
          Google shares your account ID, name, email address, and profile photo link. Updater keeps the ID, name, and
          email in an encrypted sign-in cookie and doesn&apos;t use the photo.
        </li>
        <li>Your portfolio and resumes belong to your account. Other accounts can&apos;t open them.</li>
        <li>Your workspace is still stored in this browser, not on a server.</li>
      </ul>
    </Card>
  );
}

function Card({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-md border border-border bg-surface px-5 py-6 sm:px-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-title font-semibold">{title}</h1>
        <p className="text-body text-foreground-secondary">{description}</p>
      </div>
      {children}
    </section>
  );
}
