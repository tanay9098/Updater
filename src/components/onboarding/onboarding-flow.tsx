"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CircleCheck } from "lucide-react";
import { GITHUB_PROVIDER, RSS_PROVIDER } from "@/lib/providers/registry";
import { completeOnboarding, type StartChoice } from "@/features/onboarding/onboarding";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { RadioGroup } from "@/components/ui/radio-group";
import { ProfileForm } from "@/components/portfolio/profile-section";
import { useWorkspace, useWorkspaceAction } from "@/components/workspace/workspace-provider";

const STEPS = 3;

/** First-run flow (design.md §7, PRD Journey A). Every step after the first can be skipped. */
export function OnboardingFlow() {
  const ws = useWorkspace();
  const run = useWorkspaceAction();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [choice, setChoice] = useState<StartChoice>("manual");
  const [error, setError] = useState<string | null>(null);

  // Cache Components keeps this route mounted but hidden after leaving it;
  // start from the first step when it is shown again (architecture.md §4.1).
  useEffect(
    () => () => {
      setStep(1);
      setError(null);
    },
    [],
  );

  function finish(selected: StartChoice) {
    const outcome = run((current, now) => completeOnboarding(current, selected, now), {
      success:
        selected === "demo"
          ? { title: "Demo data loaded", description: "Fictional items are labeled Demo everywhere." }
          : { title: "Setup complete" },
    });
    if (!outcome.ok && !outcome.applied) {
      setError(outcome.error.message);
      return;
    }
    router.push(selected === "manual" ? "/sources" : selected === "demo" ? "/review" : "/");
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <p className="text-meta font-medium text-muted" aria-live="polite">
        Step {step} of {STEPS}
      </p>

      {ws.onboarding.completedAt ? (
        <Alert tone="info" title="You've completed setup before">
          Going through it again keeps all your data.
        </Alert>
      ) : null}

      {step === 1 ? (
        <section className="flex flex-col gap-4" aria-labelledby="onboarding-welcome">
          <h2 id="onboarding-welcome" className="text-heading font-semibold">
            Welcome to Updater
          </h2>
          <ul className="flex flex-col gap-2 text-long">
            {[
              "Updater collects evidence of your work.",
              "It proposes updates you review.",
              "Nothing is published without your action.",
            ].map((line) => (
              <li key={line} className="flex items-start gap-2">
                <CircleCheck aria-hidden="true" size={20} strokeWidth={1.75} className="mt-1 shrink-0 text-success" />
                {line}
              </li>
            ))}
          </ul>
          <p className="text-body text-foreground-secondary">
            Your workspace is stored only in this browser. Something leaves it only when you ask: an import, or publishing your portfolio to your own GitHub repository.
          </p>
          <div>
            <Button variant="primary" onClick={() => setStep(2)}>
              Get started
            </Button>
          </div>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="flex flex-col gap-4" aria-labelledby="onboarding-profile">
          <h2 id="onboarding-profile" className="text-heading font-semibold">
            Your profile
          </h2>
          <p className="text-body text-foreground-secondary">
            Your name appears on your portfolio and resumes. You can add more details later in the Portfolio editor.
          </p>
          <ProfileForm
            key={ws.profile?.updatedAt ?? "new"}
            profile={ws.profile}
            fields="basics"
            onSaved={() => setStep(3)}
          />
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button variant="ghost" onClick={() => setStep(3)}>
              {ws.profile ? "Continue without changes" : "Skip for now"}
            </Button>
          </div>
        </section>
      ) : null}

      {step === 3 ? (
        <section className="flex flex-col gap-4" aria-labelledby="onboarding-evidence">
          <h2 id="onboarding-evidence" className="text-heading font-semibold">
            Add evidence
          </h2>
          {error ? <Alert tone="error" title="Setup couldn't be finished">{error}</Alert> : null}
          <RadioGroup
            legend="How do you want to start?"
            value={choice}
            onValueChange={setChoice}
            options={[
              {
                value: "manual",
                label: "Add your own entries",
                hint: "Go to Sources and record a project, article, contribution, or achievement.",
              },
              {
                value: "demo",
                label: "Explore with demo data",
                hint: "Loads fictional sample data, labeled Demo everywhere. You can remove it in Settings.",
              },
              { value: "skipped", label: "Skip for now", hint: "Go to the Overview. You can add evidence any time." },
            ]}
          />
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => finish(choice)}>
              Finish setup
            </Button>
            <Button variant="ghost" onClick={() => setStep(2)}>
              Back
            </Button>
          </div>
          <div className="rounded-md border border-dashed border-border-strong px-4 py-3">
            <h3 className="text-label font-semibold">More sources</h3>
            <ul className="mt-1 flex flex-col gap-1 text-support text-foreground-secondary">
              <li>
                <span className="font-medium text-foreground">{GITHUB_PROVIDER.displayName}:</span> import public
                repositories from Sources at any time. Read-only, with no GitHub sign-in.
              </li>
              <li>
                <span className="font-medium text-foreground">{RSS_PROVIDER.displayName}:</span> planned, not available
                yet. Will read {RSS_PROVIDER.permissions.reads.join(" ").replace(/\.$/, "").toLowerCase()}.
              </li>
            </ul>
            <p className="mt-1 text-support text-muted">
              Details are on <Link href="/sources" className="text-link underline underline-offset-4">Sources</Link>.
            </p>
          </div>
        </section>
      ) : null}
    </div>
  );
}
