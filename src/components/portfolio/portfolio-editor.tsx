"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMediaQuery } from "@/components/hooks/use-media-query";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { LinksSection, ProfileSection } from "./profile-section";
import { OtherAchievementsSection, ProjectsSection } from "./projects-section";
import { SkillsSection } from "./skills-section";
import { PortfolioPreview } from "./portfolio-preview";
import { PublishBar } from "./publish-bar";
import { GithubCallbackNotice } from "./github-callback-notice";

/**
 * Portfolio editor and local preview (design.md §11). Two columns at ≥ xl,
 * Edit/Preview tabs below. Unsaved edits, the saved draft, approved
 * content, the local preview, and publication (`PublishBar`, T10.9) are
 * shown as separate states.
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
      <GithubCallbackNotice />
      <PublishBar />
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
