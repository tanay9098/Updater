"use client"; // Error boundaries must be Client Components.

import { useEffect } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

/** Route-level error boundary (FR-ERR-03): retry plus a way back to Overview. */
export default function RouteError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    // Development-only diagnostics (architecture.md §14). Never sent anywhere.
    if (process.env.NODE_ENV !== "production") console.error(error);
  }, [error]);

  return (
    <>
      <PageHeader title="Something went wrong" description="This page couldn't be displayed." />
      <div className="flex max-w-2xl flex-col gap-4">
        <Alert tone="error" title="Unexpected error">
          Trying again often helps. If it keeps happening, reload the page.
        </Alert>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="primary" onClick={() => retry()}>
            Try again
          </Button>
          <Button asChild variant="secondary">
            <Link href="/">Go to Overview</Link>
          </Button>
        </div>
      </div>
    </>
  );
}
