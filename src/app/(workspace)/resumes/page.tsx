import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { ResumeList } from "@/components/resumes/resume-list";
import { WorkspaceGate } from "@/components/workspace/workspace-gate";
import { getNavItem } from "@/lib/navigation";

const page = getNavItem("resumes");

export const metadata: Metadata = { title: page.label };

export default function ResumesPage() {
  return (
    <>
      <PageHeader title={page.label} description={page.description} />
      <WorkspaceGate>
        <ResumeList />
      </WorkspaceGate>
    </>
  );
}
