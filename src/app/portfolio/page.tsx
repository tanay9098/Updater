import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { getNavItem } from "@/lib/navigation";

const page = getNavItem("portfolio");

export const metadata: Metadata = { title: page.label };

export default function PortfolioPage() {
  return (
    <>
      <PageHeader title={page.label} description={page.description} />
      <EmptyState
        title="No portfolio draft yet"
        description="The portfolio editor and preview aren't built in this version. Nothing has been published."
      />
    </>
  );
}
