import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { PortfolioEditor } from "@/components/portfolio/portfolio-editor";
import { WorkspaceGate } from "@/components/workspace/workspace-gate";
import { getNavItem } from "@/lib/navigation";

const page = getNavItem("portfolio");

export const metadata: Metadata = { title: page.label };

export default function PortfolioPage() {
  return (
    <>
      <PageHeader title={page.label} description={page.description} />
      <WorkspaceGate>
        <PortfolioEditor />
      </WorkspaceGate>
    </>
  );
}
