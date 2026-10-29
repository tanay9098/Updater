import { Suspense } from "react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { ResumeBuilderRoute } from "@/components/resumes/resume-builder";
import { PageSkeleton } from "@/components/workspace/workspace-gate";

export const metadata: Metadata = { title: "Resume builder" };

/**
 * Resume ids exist only in the browser's workspace, so the param is read on
 * the client with useParams inside Suspense (architecture.md §4.1).
 */
export default function ResumeBuilderPage() {
  return (
    <>
      <div className="print:hidden">
        <PageHeader
          title="Resume builder"
          description="Select approved content for one target role, write a summary, and print."
        />
      </div>
      <Suspense fallback={<PageSkeleton />}>
        <ResumeBuilderRoute />
      </Suspense>
    </>
  );
}
