import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { getNavItem } from "@/lib/navigation";

const page = getNavItem("resumes");

export const metadata: Metadata = { title: page.label };

export default function ResumesPage() {
  return (
    <>
      <PageHeader title={page.label} description={page.description} />
      <EmptyState
        title="No resume drafts"
        description="The resume builder isn't built in this version. Resumes will be assembled only from content you approve."
      />
    </>
  );
}
