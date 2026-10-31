import { describe, expect, it } from "vitest";
import { PUBLISHING_STATUSES, publishingStateSchema, workspaceSchema } from "@/lib/validation/domain";
import { approveReviewItem } from "@/features/review/transitions";
import { must, manualWorkspace, T0, T1, T2, workspaceWithProfile } from "@/test/fixtures";
import { SHA_A, SHA_B } from "@/test/publishing";
import type { PublishingStatus, Workspace } from "@/types/domain";
import {
  confirmPublished,
  hasUnpublishedChanges,
  nextPublishingStatus,
  recordPublishFailure,
  startPublishing,
  type PublishingEvent,
} from "./state";

const REPO = "octo-sample/octo-sample.github.io";
const URL = "https://octo-sample.github.io/";

function published(ws: Workspace = workspaceWithProfile()): Workspace {
  const started = must(startPublishing(ws, { repository: REPO, commitSha: SHA_A, contentHash: "0000000a" }, T0));
  return must(confirmPublished(started, { commitSha: SHA_A, url: URL, publishedAt: T1 }, T1));
}

describe("publishing state machine (architecture.md §7.4)", () => {
  const table: Record<PublishingStatus, Record<PublishingEvent, PublishingStatus | null>> = {
    not_published: { start: "publishing", confirm: null, fail: null },
    publishing: { start: "publishing", confirm: "published", fail: "failed" },
    published: { start: "publishing", confirm: null, fail: null },
    failed: { start: "publishing", confirm: null, fail: null },
  };
  for (const from of PUBLISHING_STATUSES) {
    for (const event of ["start", "confirm", "fail"] as const) {
      it(`${from} + ${event} → ${table[from][event] ?? "refused"}`, () => {
        expect(nextPublishingStatus(from, event)).toBe(table[from][event]);
      });
    }
  }
});

describe("publishing operations (T10.9)", () => {
  it("records the commit as publishing, without an address, until GitHub confirms the build", () => {
    const ws = must(startPublishing(workspaceWithProfile(), { repository: REPO, commitSha: SHA_A, contentHash: "0000000a" }, T0));
    expect(ws.portfolio.publishing).toEqual({
      publisherId: "github_pages",
      status: "publishing",
      repository: REPO,
      pending: { commitSha: SHA_A, contentHash: "0000000a", startedAt: T0 },
    });
    expect(workspaceSchema.safeParse(ws).success).toBe(true);
  });

  it("confirms only the pending commit, then records the address and an activity entry", () => {
    const started = must(startPublishing(workspaceWithProfile(), { repository: REPO, commitSha: SHA_A, contentHash: "0000000a" }, T0));
    const wrong = confirmPublished(started, { commitSha: SHA_B, url: URL, publishedAt: T1 }, T1);
    expect(wrong.ok).toBe(false);
    if (!wrong.ok) expect(wrong.error.code).toBe("invalid_transition");

    const ws = must(confirmPublished(started, { commitSha: SHA_A, url: URL, publishedAt: T1 }, T1));
    expect(ws.portfolio.publishing).toMatchObject({
      status: "published",
      live: { url: URL, commitSha: SHA_A, contentHash: "0000000a", publishedAt: T1 },
    });
    expect(ws.portfolio.publishing).not.toHaveProperty("pending");
    expect(ws.activity[0]).toMatchObject({ type: "portfolio_published", summary: `Published the portfolio to ${URL}` });
  });

  it("refuses to confirm or fail when nothing is being published", () => {
    expect(confirmPublished(workspaceWithProfile(), { commitSha: SHA_A, url: URL, publishedAt: T1 }, T1).ok).toBe(false);
    expect(recordPublishFailure(workspaceWithProfile(), { message: "x" }, T1).ok).toBe(false);
    expect(recordPublishFailure(published(), { message: "x" }, T1).ok).toBe(false);
  });

  it("keeps the previously published copy when a later publish fails", () => {
    const again = must(startPublishing(published(), { repository: REPO, commitSha: SHA_B, contentHash: "0000000b" }, T2));
    expect(again.portfolio.publishing).toMatchObject({ status: "publishing", live: { commitSha: SHA_A } });
    const failed = must(recordPublishFailure(again, { message: "Page build failed." }, T2));
    expect(failed.portfolio.publishing).toMatchObject({
      status: "failed",
      live: { commitSha: SHA_A, url: URL },
      lastError: { at: T2, message: "Page build failed." },
    });
    expect(failed.portfolio.publishing).not.toHaveProperty("pending");
    expect(failed.activity[0].type).toBe("portfolio_publish_failed");
  });

  it("doesn't carry a published copy over to a different repository", () => {
    const moved = must(
      startPublishing(published(), { repository: "someone/someone.github.io", commitSha: SHA_B, contentHash: "0000000b" }, T2),
    );
    expect(moved.portfolio.publishing).not.toHaveProperty("live");
  });

  it("reports changes since the last publish by fingerprint", () => {
    const ws = published();
    expect(hasUnpublishedChanges(ws, "0000000a")).toBe(false);
    expect(hasUnpublishedChanges(ws, "0000000b")).toBe(true);
    expect(hasUnpublishedChanges(workspaceWithProfile(), "0000000b")).toBe(false);
  });

  it("approving a proposal never touches publishing (rules.md §7.2.3)", () => {
    const { ws, reviewItemId } = manualWorkspace();
    const before = published(ws).portfolio.publishing;
    const approved = must(approveReviewItem(published(ws), reviewItemId, {}, T2)).workspace;
    expect(approved.portfolio.publishing).toEqual(before);
  });
});

describe("publishingStateSchema", () => {
  it("still accepts the original unpublished record, so existing workspaces load unchanged", () => {
    expect(publishingStateSchema.safeParse({ publisherId: null, status: "not_published" }).success).toBe(true);
  });

  it("rejects records whose status contradicts their contents", () => {
    const base = { publisherId: "github_pages", repository: REPO };
    expect(publishingStateSchema.safeParse({ ...base, status: "publishing" }).success).toBe(false);
    expect(publishingStateSchema.safeParse({ ...base, status: "published" }).success).toBe(false);
    expect(publishingStateSchema.safeParse({ ...base, status: "failed" }).success).toBe(false);
    expect(publishingStateSchema.safeParse({ publisherId: null, status: "published" }).success).toBe(false);
  });

  it("only accepts a user site repository named after its owner", () => {
    const record = (repository: string) => ({
      publisherId: "github_pages",
      status: "publishing",
      repository,
      pending: { commitSha: SHA_A, contentHash: "0000000a", startedAt: T0 },
    });
    expect(publishingStateSchema.safeParse(record("Octo-Sample/octo-sample.github.io")).success).toBe(true);
    expect(publishingStateSchema.safeParse(record("octo-sample/someone.github.io")).success).toBe(false);
    expect(publishingStateSchema.safeParse(record("octo-sample/portfolio")).success).toBe(false);
    expect(publishingStateSchema.safeParse(record("../x/x.github.io")).success).toBe(false);
  });

  it("never stores unknown fields such as a token (D-021)", () => {
    const ws = published();
    const withToken = { ...ws.portfolio.publishing, token: "ghs_secret" };
    expect(publishingStateSchema.safeParse(withToken).success).toBe(false);
  });
});
