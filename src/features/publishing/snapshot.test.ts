import { describe, expect, it } from "vitest";
import { updateProfile, updateProfileLinks } from "@/features/profile/profile";
import { approveReviewItem } from "@/features/review/transitions";
import { createEmptyWorkspace } from "@/features/workspace/workspace";
import { demoWorkspace, manualWorkspace, must, T0, T1, workspaceWithProfile } from "@/test/fixtures";
import { buildPublicSnapshot, contentHashOf, isSparse } from "./snapshot";

describe("buildPublicSnapshot (T10.9)", () => {
  it("needs a saved profile with a name", () => {
    const outcome = buildPublicSnapshot(createEmptyWorkspace());
    expect(outcome.ok).toBe(false);
  });

  it("publishes the profile without the email address", () => {
    const ws = must(
      updateProfile(
        createEmptyWorkspace(),
        { name: "Sam Rivera", headline: "Developer", intro: "I build tools.", location: "Lisbon", email: "sam@example.com" },
        T0,
      ),
    );
    const withLinks = must(updateProfileLinks(ws, [{ label: "Code", url: "https://example.com/sam" }], T0));
    const snapshot = must(buildPublicSnapshot(withLinks));
    expect(snapshot.portfolio.profile).toEqual({
      name: "Sam Rivera",
      headline: "Developer",
      intro: "I build tools.",
      location: "Lisbon",
      links: [{ label: "Code", url: "https://example.com/sam" }],
    });
    expect(JSON.stringify(snapshot.portfolio)).not.toContain("sam@example.com");
    expect(isSparse(snapshot.portfolio)).toBe(false);
  });

  it("includes approved projects with their summary and technologies, and nothing internal", () => {
    const { ws, reviewItemId } = manualWorkspace();
    const approved = must(approveReviewItem(ws, reviewItemId, {}, T1)).workspace;
    const snapshot = must(buildPublicSnapshot(approved));
    expect(snapshot.portfolio.projects).toHaveLength(1);
    expect(snapshot.portfolio.projects[0]).toMatchObject({ name: "Garden planner", technologies: ["TypeScript", "SQLite"] });
    expect(snapshot.portfolio.projects[0].summary).not.toBe("");
    const json = JSON.stringify(snapshot.portfolio);
    expect(json).not.toMatch(/"id"|evidence|isDemo|reviewItem/);
  });

  it("leaves demo data out and counts it", () => {
    const ws = demoWorkspace();
    const approved = ws.reviewItems.reduce(
      (current, item) => {
        const outcome = approveReviewItem(current, item.id, { acknowledgeConflict: true }, T1);
        return outcome.ok ? outcome.value.workspace : current;
      },
      ws,
    );
    expect(approved.portfolio.projects.some((project) => project.isDemo)).toBe(true);
    const snapshot = must(buildPublicSnapshot(approved));
    expect(snapshot.portfolio.projects).toEqual([]);
    expect(snapshot.portfolio.skills).toEqual([]);
    expect(snapshot.portfolio.achievements).toEqual([]);
    expect(snapshot.leftOutDemo).toBeGreaterThan(0);
    expect(JSON.stringify(snapshot.portfolio)).not.toContain("example.com");
  });

  it("leaves hidden projects out", () => {
    const { ws, reviewItemId } = manualWorkspace();
    const approved = must(approveReviewItem(ws, reviewItemId, {}, T1)).workspace;
    const hidden = {
      ...approved,
      portfolio: { ...approved.portfolio, projects: approved.portfolio.projects.map((project) => ({ ...project, visible: false })) },
    };
    expect(must(buildPublicSnapshot(hidden)).portfolio.projects).toEqual([]);
  });

  it("fingerprints content so a change is detected and an identical copy isn't", () => {
    const first = must(buildPublicSnapshot(workspaceWithProfile()));
    const same = must(buildPublicSnapshot(workspaceWithProfile()));
    expect(first.contentHash).toMatch(/^[0-9a-f]{8}$/);
    expect(same.contentHash).toBe(first.contentHash);
    const renamed = must(buildPublicSnapshot(must(updateProfile(createEmptyWorkspace(), { name: "Sam R.", headline: "", intro: "", location: "", email: "" }, T0))));
    expect(renamed.contentHash).not.toBe(first.contentHash);
    expect(contentHashOf(first.portfolio)).toBe(first.contentHash);
    expect(isSparse(first.portfolio)).toBe(true);
  });
});
