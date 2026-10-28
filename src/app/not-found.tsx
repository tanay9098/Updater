import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <>
      <PageHeader title="Page not found" description="There's no page at this address in Updater." />
      <Button asChild variant="primary">
        <Link href="/">Go to Overview</Link>
      </Button>
    </>
  );
}
