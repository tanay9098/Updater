import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import { WorkspaceGate } from "@/components/workspace/workspace-gate";

export const metadata: Metadata = { title: "Get started" };

export default function OnboardingPage() {
  return (
    <>
      <PageHeader title="Get started" description="Three short steps. Everything after the first can be skipped." />
      <WorkspaceGate>
        <OnboardingFlow />
      </WorkspaceGate>
    </>
  );
}
