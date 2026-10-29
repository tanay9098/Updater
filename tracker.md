# Updater — Implementation Tracker

Last updated: 2026-10-29 (end of Phase C) · Related: [`PRD.md`](./PRD.md) §15 (release readiness) · [`memory.md`](./memory.md) · [`rules.md`](./rules.md) §7.7

**Status vocabulary:** `Todo` · `In Progress` · `Blocked` · `Done`.
**Priorities:** `P0` required for the MVP · `P1` expected in the MVP if feasible · `P2` post-MVP.
**Rule:** a task is `Done` only after its definition of done (DoD) has been verified, and the verification is noted.

## Execution phases and review gates

The project owner reviews and approves each execution phase before the next one starts.

| Execution phase | Tracker phases | State |
| --- | --- | --- |
| A — Bootstrap | Phase 1 | **Done. Approved by the owner (Phase B requested 2026-10-28).** |
| B — Foundation | Phase 2 (plus T8.2) | **Done. Approved by the owner (Phase C requested 2026-10-29).** |
| C — Core functionality | Phases 3–8 | **Done. Awaiting owner review.** |
| D — Verification | Phase 9 | Todo |
| E — Next priorities | Phase 10 selection | Todo |

## Phase 1 — Repository and documentation bootstrap

| ID | Task | Pri | Status | Deps | Definition of done |
| --- | --- | --- | --- | --- | --- |
| T1.1 | Inspect repository, Git state, runtimes, and package managers | P0 | Done | none | Findings recorded in memory.md. *Verified:* repo was empty (no commits, no files) on branch `claude/brave-wozniak-2kxx6g`. Node 22.22.0, npm 10.9.4, pnpm, yarn, and bun present. npm registry reachable. |
| T1.2 | Write `PRD.md` | P0 | Done | T1.1 | All sections from the bootstrap spec (document control → release readiness) present, with requirement IDs and acceptance criteria. *Verified* by review against the spec. |
| T1.3 | Write `architecture.md` | P0 | Done | T1.1 | Sections 1–17 present. Status tags distinguish Implemented/MVP/Future. Diagrams match the planned stack. |
| T1.4 | Write `design.md` | P0 | Done | T1.1 | Sections 1–17 present. Color tokens have contrast ratios computed with the WCAG formula. |
| T1.5 | Write `memory.md` | P0 | Done | T1.1 | Identity, principles, terminology, technology and architectural decisions, current state, constraints, open questions, decision log, change history. |
| T1.6 | Write `rules.md` | P0 | Done | T1.1 | Sections 7.1–7.7 present. |
| T1.7 | Write `tracker.md` | P0 | Done | T1.1 | Phases 1–10 with IDs, priorities, statuses, dependencies, and DoD. |
| T1.8 | Write `AGENTS.md` | P0 | Done | T1.2–T1.7 | Reading order, required behavior, completion report. Keeps the Next.js-managed block intact. |
| T1.9 | Initialize Next.js application | P0 | Done | T1.1 | Scaffolded with `create-next-app@16.4.3` (App Router, TypeScript, Tailwind, ESLint, `src/`, `@/*` alias). Boilerplate page and assets replaced. |
| T1.10 | Project configuration | P0 | Done | T1.9 | `tsconfig` `strict: true`. ESLint flat config. Scripts `dev`, `build`, `start`, `lint`, `typecheck`. `engines.node >= 20.9.0`. System fonts (no network font fetch). |
| T1.11 | `.gitignore` | P0 | Done | T1.9 | Ignores dependencies, build output, `.env*` except `.env.example`, Playwright output, and editor files. *Verified* with `git check-ignore`. |
| T1.12 | `.env.example` | P0 | Done | T1.9 | Placeholder-only, commented-out reserved names. States that none are required. |
| T1.13 | `README.md` | P0 | Done | T1.9 | Accurate description, requirements, install/run/check commands, and doc links. Status is tracked here and in `memory.md`, not in the README (owner request, 2026-10-29). |
| T1.14 | Verify development environment | P0 | Done | T1.9–T1.13 | *Verified 2026-10-28:* `npm install` (0 vulnerabilities), `npm run lint` (no errors), `npm run typecheck` (pass), `npm run build` (pass, `/` static), `next dev` served `/` and `/icon.svg` with HTTP 200, `next start` served `/` with HTTP 200. Re-run from a clean `.next`. `next dev` left AGENTS.md unchanged. |

## Phase 2 — Application foundation

| ID | Task | Pri | Status | Deps | Definition of done |
| --- | --- | --- | --- | --- | --- |
| T2.1 | Application shell: sidebar (≥ lg), top bar, mobile drawer, main region, skip link | P0 | Done | T1.14 | Layout matches design.md §4. Landmarks present. No horizontal scroll at 320 px. *Verified 2026-10-28* (Playwright on `next start`): skip link is first in tab order and focuses `main`; one `header`, one `main`, `nav` "Primary"; sidebar ≥ lg, drawer below lg (closes on Escape, link, and resize to desktop; focus returns to the trigger); no horizontal scroll at 320/768/1280 px on all six routes in both themes. |
| T2.2 | Semantic design tokens in `globals.css` mapped to Tailwind | P0 | Done | T1.14 | Every token in design.md §2.1 is defined for light and dark. Components use only token utilities. *Verified:* all §2.1 tokens are defined for both themes, plus five Phase B additions (design.md §2.1). Tailwind's default palette, font sizes, and weights are reset, so only token utilities compile. Contrast of the added pairs computed (≥ 5.3:1). |
| T2.3 | Bright/dark themes, toggle, persistence, no flash | P0 | Done | T2.2 | Light by default regardless of OS. Toggle has an accessible name and state. Preference persists in `updater:theme`. A reload in dark paints dark first (checked in a browser). *Verified:* unit tests for parse, read, and write, and the bootstrap script. Component tests for the toggle (name, `aria-pressed`, keyboard, persistence, blocked-storage warning). Playwright: light with OS dark preference; dark reload paints dark with all JS bundles blocked; state survives hydration and the dev Strict Mode remount. |
| T2.4 | Navigation and routes: Overview, Sources, Review Queue, Portfolio, Resumes, Settings, plus `error.tsx` and `not-found.tsx` | P0 | Done | T2.1 | All routes render with a heading and an honest empty state. Active item is marked with `aria-current="page"`. Focus moves to `h1` on navigation. *Verified:* Playwright clicked every sidebar link: correct `h1`, a single `aria-current="page"`, focus on the visible `h1` (also after Back), titles "{Page} · Updater". `/does-not-exist` → 404 page. `error.tsx` component test (retry + Overview link). |
| T2.5 | Accessible UI components (Button, Field, Input, Textarea, Select, Checkbox, Switch, Tabs, Dialog, ConfirmDialog, Menu, Tooltip, Badge/StatusIndicator, EmptyState, Toast, Skeleton) | P0 | Done | T2.2 | Built on Radix where specified. Keyboard and focus behavior verified in component tests. *Verified:* component tests cover Field wiring (`aria-describedby`, `aria-invalid`, "(required)"), Button loading/`aria-busy`, Checkbox, Switch, Dialog (focus trap, Escape, focus return), ConfirmDialog (Cancel focused first, async confirm, failure shown), Menu and Tabs arrow keys, Toast, Alert roles, LoadingState. Visual check in both themes via a temporary gallery (removed). RadioGroup and Panel were added as well. |
| T2.6 | Validation conventions (Zod, `Result` type, field error helpers, `safeExternalUrl`) | P0 | Done | T1.14 | Schemas live in `src/lib/validation`. Unit tests for URL validation and error mapping. *Verified:* `src/lib/validation/{result,url,schemas,field-errors}.ts` with unit tests (URL allow-list incl. `javascript:`, `data:`, credentials; nested field paths). |
| T2.7 | Testing conventions (Vitest, Testing Library, jsdom, `npm test`) | P0 | Done | T1.14 | `npm test` runs and passes with at least one unit and one component test. Documented in README. *Verified:* `npm test` (`vitest run`) passes; config in `vitest.config.mts`, Radix stubs in `vitest.setup.ts`; README documents it. |
| T2.8 | Add dependencies: `lucide-react`, `radix-ui`, `zod`, and test tooling | P0 | Done | T1.14 | Installed versions recorded in the lockfile. Reasons recorded in memory.md. *Verified:* installed (versions and reasons in memory.md). `npm ci` from the lockfile succeeds with npm 10.9.4; 0 vulnerabilities. |

## Phase 3 — Profile and domain model

| ID | Task | Pri | Status | Deps | Definition of done |
| --- | --- | --- | --- | --- | --- |
| T3.1 | Typed domain models and Zod schemas (architecture.md §5) | P0 | Done | T2.6 | Every entity has a schema and an inferred type. Invalid fixtures are rejected in tests. *Verified 2026-10-29:* `src/lib/validation/domain.ts` (strict Zod objects, cross-reference checks) and `src/types/domain.ts` (inferred types). Tests reject tampered statuses, unknown fields, broken provenance, and over-long skill names. |
| T3.2 | Workspace document v1 + empty workspace factory | P0 | Done | T3.1 | `createEmptyWorkspace()` validates against the schema. *Verified 2026-10-29:* used by every store and domain test; the round-trip tests parse it with `workspaceSchema`. |
| T3.3 | Local storage adapter: load, validate, migrate, save, recovery | P0 | Done | T3.2 | Tests cover valid load, corrupt JSON, schema mismatch (raw value kept in the recovery key), quota/unavailable errors, and no secret fields in the schema. *Verified 2026-10-29:* `src/lib/data/storage.test.ts` covers each case; strict schemas reject a `githubToken`/`accessToken` field. |
| T3.4 | Workspace store (context + reducer composed from pure functions) with save status | P0 | Done | T3.3 | Actions return `Result`. Save status reflects the real adapter outcome. Integration test with an in-memory adapter. *Verified 2026-10-29:* `src/features/workspace/store.ts` (external store, `useSyncExternalStore` binding) with `store.test.ts`: saved/error/retry states, refused operations change nothing, results failing the schema are refused, reload persistence. |
| T3.5 | Profile editing (name, headline, intro, location, email, links) | P0 | Done | T3.4, T2.5 | Inline validation. Persists after reload. FR-PROF-01 criteria met. *Verified 2026-10-29:* profile form in onboarding, Portfolio, and Settings; unit and component tests; Playwright reload check. |
| T3.6 | Source, source item, and evidence representations + ingestion pipeline | P0 | Done | T3.1 | `ingestItems` validates, de-duplicates by `(sourceId, externalId)`, and derives evidence. Tests included. *Verified 2026-10-29:* `src/features/sources/ingestion.ts` + `sources.test.ts` (rejections with reasons, de-duplication updates the snapshot, automatic conflict marking). |
| T3.7 | Review and publishing state machines (architecture.md §7.1, §7.4) | P0 | Done | T3.1 | Unit tests for every allowed and disallowed transition. Approval leaves publishing state unchanged. *Verified 2026-10-29:* `transitions.test.ts` checks all 20 cells of the §7.1 table plus not-found, conflict, and publishing-unchanged cases. Publishing has no reachable transition in the MVP (schema allows only `not_published`). |
| T3.8 | Onboarding flow (`/onboarding`) | P0 | Done | T3.5, T4.3 | Journey A works end to end. Optional steps are skippable. Choice persists. *Verified 2026-10-29:* Playwright (Chromium, `next start`): Overview → Get started → profile with inline error → demo choice → Review Queue; state survives reload. Overview links to onboarding instead of redirecting (design.md §7). |

## Phase 4 — Sources and evidence

| ID | Task | Pri | Status | Deps | Definition of done |
| --- | --- | --- | --- | --- | --- |
| T4.1 | Provider descriptors + registry (manual, demo, planned github, planned rss) | P0 | Done | T3.1 | Descriptor type per architecture.md §9. Planned descriptors expose no operations. Unit test asserts no planned provider can yield `connected`. *Verified 2026-10-29:* `src/lib/providers/{types,registry}.ts`; `sources.test.ts`. |
| T4.2 | Sources page with honest status badges, capabilities, permissions, and setup notes | P0 | Done | T4.1, T2.5 | design.md §9 implemented. FR-SRC-01/02 criteria met. *Verified 2026-10-29:* component test (Local / Not loaded / Planned badges, no connect button, no "Connected" text) and Playwright. |
| T4.3 | Demo fixtures (fictional, `example.com` URLs, `isDemo`) + load/remove | P0 | Done | T3.6 | Demo badges on every surface (FR-SRC-03). Removal works with confirmation and the keep-claims choice. *Verified 2026-10-29:* fixtures use example.com only (test); Demo labels on Sources, Review, Portfolio editor and preview, resume preview/print, Overview, plus the top-bar indicator; removal tested in unit, component, and Playwright runs (both choices). |
| T4.4 | Manual entry dialog → source item + user-asserted evidence + review item | P0 | Done | T3.6, T3.7 | FR-SRC-04 met. Persists after reload. *Verified 2026-10-29:* unit and component tests (validation, `user_asserted` evidence, proposal); Playwright. |
| T4.5 | Source item lists with evidence counts and safe external links | P0 | Done | T4.2 | Links pass `safeExternalUrl` and open in a new tab with `rel="noopener noreferrer"`. *Verified 2026-10-29:* `ExternalLink` renders nothing for unsafe URLs; component test checks `href`, `target`, and `rel` on demo items. |
| T4.6 | Empty, unavailable, and error states on Sources | P0 | Done | T4.2 | Each state is rendered and covered by a component test. *Verified 2026-10-29:* component tests cover the empty states ("No entries yet…", "Not loaded…"), the validation-error state in the entry dialog, and a labeled badge for every source status. `unavailable`, `needs_attention`, and `syncing` have no producer in the MVP (no real provider exists), so they appear only in that badge test, never on the live page. |
| T4.7 | Document the GitHub integration path in the Planned card and architecture | P1 | Done | T4.1 | Card states future permissions and flow. No connect button. *Verified 2026-10-29:* GitHub and RSS descriptors carry permissions and the planned flow; component test asserts no button in their panels. |

## Phase 5 — Review queue

| ID | Task | Pri | Status | Deps | Definition of done |
| --- | --- | --- | --- | --- | --- |
| T5.1 | Review list with status tabs and counts | P0 | Done | T3.7, T2.5 | FR-REV-01/02 met. *Verified 2026-10-29:* tabs with counts (component test, Playwright). |
| T5.2 | Provenance detail: evidence, verification, source link, wording origin, "why suggested" | P0 | Done | T5.1 | design.md §10 expanded view implemented. *Verified 2026-10-29:* expanded view shows wording origin, original proposal, "Why suggested", evidence with verification and facts, source link. |
| T5.3 | Edit (keeps original) and revert edit | P0 | Done | T5.1 | FR-EDIT-01 met. The original is viewable. *Verified 2026-10-29:* component test (edit, validation, show original, revert with confirmation). |
| T5.4 | Approve → claim/project/skill created in the portfolio draft. Conflict acknowledgement. | P0 | Done | T5.1 | FR-EDIT-02/04, FR-EVID-04 met. *Verified 2026-10-29:* unit and component tests (project + summary claim, achievement, skill merge, conflict acknowledgement dialog, publishing unchanged). |
| T5.5 | Dismiss with optional reason, and restore | P0 | Done | T5.1 | FR-EDIT-03 met. Evidence still listed on Sources. *Verified 2026-10-29:* unit and component tests (reason stored, evidence kept, restore). |
| T5.6 | Tests for review state transitions through the UI and store | P0 | Done | T5.3–T5.5 | Component and integration tests pass. *Verified 2026-10-29:* `review-queue.test.tsx` (7 tests incl. no success toast when saving fails) and `store.test.ts`. |

## Phase 6 — Portfolio

| ID | Task | Pri | Status | Deps | Definition of done |
| --- | --- | --- | --- | --- | --- |
| T6.1 | Portfolio editor: profile and links sections | P0 | Done | T3.5 | Edits persist. Inline validation. *Verified 2026-10-29:* component test and Playwright (invalid link URL rejected inline, then saved). |
| T6.2 | Projects: add, edit, reorder (buttons), visibility, delete with confirmation | P0 | Done | T5.4 | FR-PORT-02 met. *Verified 2026-10-29:* unit tests (add, reorder, hide, delete keeps evidence) and component test (add, delete with confirmation). |
| T6.3 | Skills with origin indicators | P0 | Done | T5.4 | Add and remove work. Origin shown. *Verified 2026-10-29:* unit tests; chips show an origin dot plus screen-reader text. |
| T6.4 | Claims with origin badges, evidence popover, edit → `edited_from_source` | P0 | Done | T5.4 | FR-PORT-04, FR-EDIT-05 met. Unit test for the origin change. *Verified 2026-10-29:* `originAfterEdit` unit test; component test edits a source claim and checks `edited_from_source` with evidence kept; evidence dialog test. |
| T6.5 | Local preview labeled "Local preview: not published" | P0 | Done | T6.1–T6.4 | FR-PORT-03 met. Demo labels visible in the preview. *Verified 2026-10-29:* component test for the header text. |
| T6.6 | Draft vs publication state; Publish disabled with explanation | P0 | Done | T6.5 | FR-PUB-01 met. No public URL claimed anywhere. *Verified 2026-10-29:* component test: Publish disabled with an accessible description; "Not published" badge. |

## Phase 7 — Resume builder

| ID | Task | Pri | Status | Deps | Definition of done |
| --- | --- | --- | --- | --- | --- |
| T7.1 | Resume list + create with target role; rename, duplicate, delete | P0 | Done | T3.4 | FR-RES-01 met. *Verified 2026-10-29:* unit tests (create, rename, duplicate, delete) and component tests (create with validation, delete with confirmation). |
| T7.2 | Select approved projects, claims, and skills; per-resume wording overrides | P0 | Done | T7.1, T5.4 | FR-RES-02/03 met. Overrides do not change claims (test). *Verified 2026-10-29:* unit and component tests assert claims and evidence are unchanged after saving overrides. |
| T7.3 | Summary editing with "insert portfolio introduction" | P0 | Done | T7.1 | No generated text. *Verified 2026-10-29:* "Insert portfolio introduction" copies the user's own intro; tests assert suggestions leave the summary empty. |
| T7.4 | Resume preview | P0 | Done | T7.2 | Single-column, semantic headings. *Verified 2026-10-29:* `ResumeDocumentView`; component test checks override text in the preview. |
| T7.5 | Print stylesheet + "Print / Save as PDF" | P0 | Done | T7.4 | Print preview hides chrome and is readable in both themes. Limitation documented (no generated PDF). *Verified 2026-10-29:* Playwright print emulation in the dark theme renders black on white without app chrome; `page.pdf` produced an A4 PDF. |
| T7.6 | Draft persistence and save status | P0 | Done | T7.1 | Persists after reload. *Verified 2026-10-29:* Playwright: saved summary present after reload; component test. |
| T7.7 | `suggestSelections` keyword-overlap tailoring | P1 | Done | T7.2 | Unit tests. Only pre-selects and never adds text. *Verified 2026-10-29:* `resumes.test.ts` (tokenizer, role hints, workspace unchanged). |

## Phase 8 — Settings and privacy

| ID | Task | Pri | Status | Deps | Definition of done |
| --- | --- | --- | --- | --- | --- |
| T8.1 | Profile basics in Settings | P0 | Done | T3.5 | Edits persist. *Verified 2026-10-29:* component test. |
| T8.2 | Appearance: theme radio group synced with toggle | P0 | Done | T2.3 | Both controls stay in sync and persist. *Built early in Phase B (D-018). Verified:* component test and Playwright show the radio group and the top-bar toggle stay in sync and persist. |
| T8.3 | Integration status summary | P0 | Done | T4.1 | Mirrors the Sources statuses exactly. *Verified 2026-10-29:* both use `presentStatus(provider, providerStatus(...))`; component test. |
| T8.4 | Privacy section with accurate text | P0 | Done | T3.3 | Text matches actual behavior (FR-SET-03). *Verified 2026-10-29:* component test; text reviewed against the implementation (no network calls, no analytics). |
| T8.5 | Export JSON, import with validation, reset, remove demo data, restart onboarding | P0 (import P1) | Done | T3.3 | FR-DATA-04, FR-SET-02 met. A failed import changes nothing (test). *Verified 2026-10-29:* component tests (failed import leaves storage byte-identical; valid import replaces after confirmation; reset); Playwright export download. |
| T8.6 | Confirmation dialogs for all destructive operations | P0 | Done | T2.5 | Each names what is lost. Cancel is focused first. *Verified 2026-10-29:* reset, import-replace, remove demo data, delete project/achievement/resume, revert edit use `ConfirmDialog` with counts; tests check Cancel focus. |

## Phase 9 — Testing and release readiness

| ID | Task | Pri | Status | Deps | Definition of done |
| --- | --- | --- | --- | --- | --- |
| T9.1 | Unit tests for domain rules (transitions, provenance, proposals, ingestion, URL, tailoring, migrations) | P0 | Todo | Phases 3–7 | `npm test` passes. Coverage of every §7.1 transition. |
| T9.2 | Component tests (review actions, forms, theme toggle, confirmations, demo labels) | P0 | Todo | Phases 2–8 | Pass. |
| T9.3 | Integration tests (store + storage adapter, export/import round trip) | P0 | Todo | T3.4, T8.5 | Pass. |
| T9.4 | Type check | P0 | Todo | all | `npm run typecheck` passes. |
| T9.5 | Lint | P0 | Todo | all | `npm run lint` passes with no warnings suppressed globally. |
| T9.6 | Production build | P0 | Todo | all | `npm run build` passes. |
| T9.7 | Accessibility review (keyboard, focus, names, contrast, axe scan if available) | P0 | Todo | Phases 2–8 | Findings fixed or recorded in memory.md. |
| T9.8 | Responsive checks at 320, 768, and 1280 px | P0 | Todo | Phases 2–8 | No horizontal scroll. Primary actions reachable. |
| T9.9 | Playwright E2E for Journeys A–E | P1 | Todo | Phases 3–8 | Pass in Chromium. If browser automation is unavailable, record that and why. |
| T9.10 | README verification on a clean checkout | P0 | Todo | T9.4–T9.6 | Commands run as documented. |
| T9.11 | Documentation sync review | P0 | Todo | all | All docs match the implementation (PRD.md R10). |

## Phase 10 — Future integrations

These stay open until actually implemented and verified.

| ID | Task | Pri | Status | Deps | Definition of done |
| --- | --- | --- | --- | --- | --- |
| T10.1 | GitHub public repository import (read-only, server route, optional `GITHUB_TOKEN`) | P1 | Todo | MVP | Real API data imported through the provider contract. Rate limits handled. Status truthful. |
| T10.2 | GitHub OAuth (authorization code + PKCE, server-side tokens) | P2 | Todo | T10.1, T10.5 | Real authorization. Disconnect revokes. No token in the browser. |
| T10.3 | Pull-request and contribution ingestion | P2 | Todo | T10.1 | Merged PRs become evidence with URLs. |
| T10.4 | Durable server persistence (`ServerWorkspaceStorage`) | P2 | Todo | T10.5 | Same interface as local storage. One-time local import. |
| T10.5 | User authentication (established library) | P2 | Todo | MVP | Server-side authorization on every request. |
| T10.6 | Scheduled synchronization / background jobs | P2 | Todo | T10.1, T10.4 | Recorded sync results. Backoff on failures. |
| T10.7 | AI-assisted drafting (optional, server-side, evidence-grounded) | P2 | Todo | MVP | rules.md §7.6 enforced, including a post-check that rejects unsupported numbers. |
| T10.8 | Blog integrations (RSS/Atom, DEV, Hashnode) | P2 | Todo | MVP | SSRF-safe fetching. Articles become evidence. |
| T10.9 | Real portfolio publishing (Publisher adapter) | P2 | Todo | T10.4 | Status, URL, failure, and rollback reported truthfully. |
| T10.10 | Additional export formats (JSON Resume, generated PDF) | P2 | Todo | Phase 7 | Output validated. No ATS claim without validation. |

## Next recommended task

After the owner approves Phase C: start **Phase D** with **T9.9** (commit the Playwright Journey A–E run as an `e2e/` suite; a one-off script already passes in Chromium), **T9.7** (accessibility review with an axe scan), and **T9.11** (documentation sync review).
