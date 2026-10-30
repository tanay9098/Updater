import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";

/** Unmatched URLs render here, outside the (workspace) group, so this page brings its own shell. */
export default function NotFound() {
  return (
    <AppShell>
      <PageHeader title="Page not found" description="There's no page at this address in Updater." />
      <Button asChild variant="primary">
        <Link href="/">Go to Overview</Link>
      </Button>
    </AppShell>
  );
}
