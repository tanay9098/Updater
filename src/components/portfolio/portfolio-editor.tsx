"use client";

import { useState } from "react";
import { Globe } from "lucide-react";
import { formatTime } from "@/lib/utils/dates";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMediaQuery } from "@/components/hooks/use-media-query";
import { PublicationBadge } from "@/components/workspace/badges";
import { useWorkspace, useWorkspaceSnapshot } from "@/components/workspace/workspace-provider";
import { LinksSection, ProfileSection } from "./profile-section";
import { OtherAchievementsSection, ProjectsSection } from "./projects-section";
import { SkillsSection } from "./skills-section";
import { PortfolioPreview } from "./portfolio-preview";

/**
 * Portfolio editor and local preview (design.md §11). Two columns at ≥ xl,
 * Edit/Preview tabs below. Unsaved edits, the saved draft, approved
 * content, the local preview, and publication are shown as separate states.
 */
export function PortfolioEditor() {
  const ws = useWorkspace();
  const wide = useMediaQuery("(min-width: 80rem)");
  const [tab, setTab] = useState("edit");

  const editor = (
    <div className="flex flex-col gap-6">
      <ProfileSection profile={ws.profile} />
      <LinksSection profile={ws.profile} />
      <SkillsSection ws={ws} />
      <ProjectsSection ws={ws} />
      <OtherAchievementsSection ws={ws} />
    </div>
  );
  const preview = <PortfolioPreview ws={ws} />;

  return (
    <div className="flex flex-col gap-6">
      <DraftStatus />
      {wide ? (
        <div className="grid grid-cols-[minmax(0,11fr)_minmax(0,9fr)] items-start gap-6">
          {editor}
          <div className="sticky top-20 max-h-[calc(100dvh-6rem)] overflow-y-auto">{preview}</div>
        </div>
      ) : (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList aria-label="Portfolio views">
            <TabsTrigger value="edit">Edit</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
          </TabsList>
          <TabsContent value="edit">{editor}</TabsContent>
          <TabsContent value="preview">{preview}</TabsContent>
        </Tabs>
      )}
    </div>
  );
}

/** "Draft · Saved locally 14:02 · Not published", plus the disabled Publish control (FR-PUB-01). */
function DraftStatus() {
  const snapshot = useWorkspaceSnapshot();
  const save = snapshot.phase === "ready" ? snapshot.save : null;
  const saveText =
    save?.state === "saved"
      ? `Saved locally ${formatTime(save.savedAt)}`
      : save?.state === "error"
        ? "Not saved: see the save status"
        : "Stored in this browser";

  return (
    <div className="flex flex-col gap-3 rounded-md border border-border bg-surface px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <div className="flex flex-col gap-1">
        <p className="flex flex-wrap items-center gap-2 text-label font-medium">
          <span>Draft</span>
          <span aria-hidden="true" className="text-muted">·</span>
          <span className={save?.state === "error" ? "text-error" : "text-foreground-secondary"}>{saveText}</span>
          <span aria-hidden="true" className="text-muted">·</span>
          <PublicationBadge />
        </p>
        <p id="publish-help" className="text-support text-muted">
          Publishing isn&apos;t available in this version. Use the preview to check your portfolio.
        </p>
      </div>
      <Button variant="secondary" disabled aria-describedby="publish-help">
        <Globe aria-hidden="true" size={16} strokeWidth={1.75} />
        Publish
      </Button>
    </div>
  );
}
