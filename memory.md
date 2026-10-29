# Updater — Project Memory

This is the durable context for future development sessions. It records confirmed decisions and the **verified** implementation state. Keep it concise and current. Do not use it as a daily diary.

Last updated: 2026-10-28 (end of Phase B)

## Project identity

- **Name:** Updater
- **Concept:** a developer portfolio auto-updater. It collects verifiable evidence of a developer's work (repositories, pull requests, articles, user-supplied facts), proposes portfolio and resume updates tied to that evidence, and lets the developer review every change. Nothing is published automatically.
- **Target users:** developers grouped by the work Updater supports, not by name, career stage, or job title: work spread across several platforms, contributions to repositories they don't own, published technical writing, several resume versions, and work that isn't publicly verifiable (PRD.md §4).
- **Primary user value:** an up-to-date, evidence-backed portfolio and role-specific resumes without repetitive manual maintenance, and without embellishment.

## Confirmed product principles

1. Evidence over embellishment.
2. Human approval before publishing. Approval ≠ publication.
3. Provenance for every factual claim.
4. AI-generated content (future) is an editable draft.
5. Privacy and security by design.
6. Truthful representation of integration, sync, and publication status.
7. Progressive implementation: a dependable local MVP first.
8. Professional simplicity in the interface.

## Terminology

| Term | Meaning |
| --- | --- |
| **Source** | A configured origin of evidence: Manual entries, the Demo workspace, and in future a GitHub account or blog feed. |
| **Source item** | One original thing from a source (repository, pull request, article, user-entered project or achievement), stored as a normalized snapshot with URL and timestamps. |
| **Evidence** | A specific fact or excerpt drawn from a source item, or a statement asserted by the user, with a verification state. |
| **Claim** | A sentence in the portfolio or a resume asserting something about the developer's work. It always records its origin and supporting evidence. |
| **Generated content** | Wording produced by Updater (templates in the MVP, AI drafts in future). It is never evidence. |
| **Review item** | A proposal (generated or user wording plus linked evidence) awaiting edit, approve, or dismiss. |
| **Approved content** | Claims, projects, and skills the user approved. Only approved content enters the portfolio draft and resumes. |
| **Portfolio draft** | The locally saved, editable portfolio built from the profile and approved content. |
| **Published portfolio** | A portfolio a real publisher has confirmed as publicly available. It does not exist in the MVP. |
| **Resume draft** | A role-specific selection of approved content, plus a user-written summary and per-resume wording overrides. |
| **Demo data** | Fictional fixture content, flagged `isDemo`, labeled everywhere, using `example.com` URLs. |

## Technology decisions

| Area | Decision | Status |
| --- | --- | --- |
| Framework | Next.js 16 App Router, Turbopack, Cache Components (scaffold defaults) | Implemented |
| Language | TypeScript 5, `strict` | Implemented |
| Styling | Tailwind CSS v4 + semantic CSS custom properties; Tailwind defaults reset (D-014) | Implemented |
| Fonts | System font stacks | Implemented |
| Lint | ESLint 9, `eslint-config-next` | Implemented |
| Icons | lucide-react | Implemented |
| Accessible primitives | Radix UI (`radix-ui`) | Implemented |
| Validation | Zod | Helpers implemented; entity schemas in T3.1 |
| Forms | Controlled components + Zod helpers | Planned |
| Tests | Vitest + Testing Library + jsdom (D-015); Playwright for E2E | Vitest implemented; Playwright E2E planned (T9.9) |
| Storage | `localStorage` behind a `WorkspaceStorage` adapter | Planned (T3.3) |

Exact versions live in `package.json` and `package-lock.json`. At Phase A they were: next 16.4.3, react/react-dom 19.3.0, typescript 5.9.3, tailwindcss 4.3.3, eslint 9.39.5.

**Dependencies added in Phase B, and why** (rules.md §7.4.4):

| Package | Version | Kind | Reason |
| --- | --- | --- | --- |
| `radix-ui` | 1.8.1 | runtime | Accessible dialogs, alert dialogs, menus, tabs, tooltips, checkbox, switch, radio group, toast (D-005) |
| `lucide-react` | 1.63.0 | runtime | Icon set named in design.md §1 |
| `zod` | 4.6.7 | runtime | Single schema source for validation (D-006) |
| `vitest` | 4.1.12 | dev | Test runner (D-007). 4.x keeps Node 20 support; 5.x requires Node 22.12+ (D-015) |
| `jsdom` | 28.1.0 | dev | DOM for component tests. 29.x requires Node 22.22.2+, newer than this container's 22.22.0 |
| `@vitejs/plugin-react` | 6.1.2 | dev | JSX transform for Vitest, as in the Next.js Vitest guide |
| `@testing-library/react`, `/dom`, `/user-event`, `/jest-dom` | 16.3.3, 10.4.2, 14.6.8, 7.0.1 | dev | Accessibility-tree queries, realistic keyboard and pointer events, DOM matchers |

Install note: npm 10.9.4 crashes on `npm install -D vitest` with `Cannot read properties of null (reading 'edgesOut')`, an npm arborist peer-set bug. The lockfile was resolved once with `npx npm@11 install -D vitest@^4.1.12`. Lockfile format v3 is unchanged, and `npm ci` with npm 10 installs it cleanly.

## Architectural decisions

See the [decision log](#decision-log) below. architecture.md §17 summarizes the same IDs.

## Current implementation state

| Item | State | Verification |
| --- | --- | --- |
| Seven project documents, README, `.gitignore`, `.env.example` | Implemented | Written 2026-10-28. Cross-references checked by hand. |
| Next.js scaffold and configuration | Implemented | lint, typecheck, and build pass. dev and start serve `/` with HTTP 200 (2026-10-28). |
| App shell, navigation, six page shells, error and not-found pages | Implemented. Pages show honest empty states, not business features. | Component tests, plus a Playwright run against `next start` (2026-10-28): every nav link works, `aria-current` is correct, focus moves to `h1` (also on back navigation), skip link works, no horizontal overflow at 320/768/1280 px in both themes, unknown routes return 404 |
| Themes | Implemented: bright default, dark, toggle, Settings → Appearance, persistence, no flash, cross-tab sync | Unit and component tests. Playwright: light on first visit even with OS dark preference; after choosing dark, a reload with all JS bundles blocked still paints dark; blocked storage shows the "this visit only" warning; dev-mode Strict Mode keeps the stored theme; no console errors |
| UI component library (`src/components/ui`) | Implemented | Component tests for keyboard and focus behavior (dialog, confirmation, menu, tabs, toast, form fields). Visual check of every component in both themes via a temporary gallery route that was deleted before commit |
| Validation conventions | `Result`, `validate`, `toFieldErrors`, `safeExternalUrl`, shared Zod helpers | Unit tests |
| Domain model, storage, store | Not started | none |
| Sources, review queue, portfolio, resumes, settings | Not started | none |
| Tests | Vitest: 10 files, 75 tests | `npm test` passes (see the change history) |

## Constraints

- The app must run locally with no credentials, network services, or paid dependencies.
- The MVP has no backend persistence, authentication, AI, or publishing.
- Development container: Node 22.22.0, npm 10.9.4. Outbound HTTPS goes through a proxy, and the npm registry is reachable. Chromium + Playwright are pre-installed (useful for T9.9).
- The installed Next.js (16.4.x) postdates much model training data. Read `node_modules/next/dist/docs/` before using framework APIs (AGENTS.md).
- `next dev` rewrites a managed block in `AGENTS.md`. That block must be kept (D-012).
- Known MVP limitation: data is per-browser and lost if site data is cleared (export mitigates this).

## Assumptions and open questions

**Assumptions:**

- Users accept local-only storage in the MVP.
- Evergreen browsers.
- English-only UI for now.

**Open questions (unresolved):**

1. Should resumes support non-project experience entries (employment history) in the MVP, as user-supplied claims? This is currently out of scope, and claims attach to projects.
2. Is a GitHub *public, read-only* import (T10.1) acceptable as the first real integration before OAuth? It is recommended as the first post-MVP task.
3. Preferred print page size default: A4 or Letter? The current plan is to support both via CSS without forcing either.
4. Should approved claims be revocable back into the review queue? The current design says no: manage them in the portfolio instead.
5. The browser check in Phase B was a one-off Playwright script, not a committed test. Should it become the seed of the `e2e/` suite now, or wait for T9.9 as planned?

## Decision log

| ID | Date | Context | Decision | Rationale | Consequences | Status |
| --- | --- | --- | --- | --- | --- | --- |
| D-001 | 2026-10-28 | Empty repo, stack requested | Next.js App Router + TypeScript strict + Tailwind v4 via `create-next-app@16.4.3` defaults | Matches spec, maintained defaults | Must follow Next 16 docs in `node_modules` | Accepted |
| D-002 | 2026-10-28 | Scaffold used `next/font/google` (Geist) | Use system font stacks | No build-time network, no third-party requests, privacy | Slight cross-platform typography variance | Accepted |
| D-003 | 2026-10-28 | MVP must run without services | One versioned, Zod-validated workspace document in `localStorage` behind an adapter | Simple, credential-free, swappable | Single device. Export needed for backup. | Accepted |
| D-004 | 2026-10-28 | Avoid appearance-driven dependencies | No auth, DB, AI, or paid service in the MVP | rules.md §7.4/§7.5 | Integrations show Planned | Accepted |
| D-005 | 2026-10-28 | Need accessible dialogs, menus, tabs | Radix UI primitives with own Tailwind styling | Proven a11y, light footprint | Maintain small wrappers | Accepted (to be installed in Phase B) |
| D-006 | 2026-10-28 | Runtime validation for storage, import, forms | Zod as single schema source. Controlled forms. | One schema everywhere | May add react-hook-form later via a new decision | Accepted (Phase B) |
| D-007 | 2026-10-28 | Test tooling | Vitest + Testing Library + jsdom; Playwright E2E | ESM/TS-native. Playwright available locally. | Two runners | Accepted (Phase B/D) |
| D-008 | 2026-10-28 | Bright default, no flash | `data-theme` on `<html>` set by a static inline script from `localStorage`; ignore OS preference for the default | Spec requires a bright default. Keeps routes static. | `suppressHydrationWarning` on `<html>` | Accepted (Phase B) |
| D-009 | 2026-10-28 | Proposals without AI | Deterministic templates over evidence fields | Truthful and testable | Plain wording that users edit | Accepted (Phase C) |
| D-010 | 2026-10-28 | Demo data must not look real | Fictional names, `example.com` URLs, `isDemo` flag | Cannot be mistaken for real activity | Demo links go to placeholder pages | Accepted (Phase C) |
| D-011 | 2026-10-28 | Scaffold enables `cacheComponents` | Keep it | Framework default. Workspace UI is client-side. | Server components follow Cache Components rules | Accepted |
| D-012 | 2026-10-28 | `next dev` maintains a block in AGENTS.md | Keep the managed block inside our AGENTS.md | Prevents churn. Points to version-matched docs. | One managed section in AGENTS.md | Accepted |
| D-013 | 2026-10-28 | design.md had the theme button change its label *and* use `aria-pressed` | Constant name "Dark theme" + `aria-pressed`; tooltip names the action; icon chosen by CSS | WAI-ARIA toggle pattern; avoids contradictory announcements; correct icon before hydration | design.md §2 records the deviation | Accepted |
| D-014 | 2026-10-28 | Avoid raw colors in components | Reset Tailwind's default palette, font sizes, and weights in `globals.css`; only semantic tokens exist | Enforced by the build, not by review | Five tokens added (design.md §2.1) | Accepted |
| D-015 | 2026-10-28 | Latest Vitest/jsdom drop Node 20 (and jsdom 29 excludes Node 22.22.0) | Vitest 4.1, jsdom 28; `engines.node` `>=20.19.0` (Vite 8 minimum) | Keep Node 20 LTS working | Contributors need Node ≥ 20.19 | Accepted |
| D-016 | 2026-10-28 | Class-name helper | Own `cn()`; no `clsx`/`tailwind-merge` | Fewer dependencies | Components expose variants/sizes; callers avoid conflicting utilities | Accepted |
| D-017 | 2026-10-28 | Cache Components keeps visited routes mounted but hidden (`<Activity>`) | Route focus lives in `PageHeader` (effect on visibility); `usePathname` consumers wrapped in `<Suspense>`; transient overlays close on navigation | Matches Next.js 16 behavior documented in `node_modules/next/dist/docs` | See architecture.md §4.1 | Accepted |
| D-018 | 2026-10-28 | Settings → Appearance (T8.2) only depends on the theme system | Built in Phase B; the rest of Settings stays in Phase C | Gives the theme switcher its specified second control | T8.2 marked Done in Phase B | Accepted |

## Change history

- **2026-10-28 — Phase B (foundation).** The owner approved Phase A by requesting Phase B. Implemented design tokens for both themes, theme persistence without flash, the responsive shell (sidebar, top bar, drawer, skip link), navigation and six page shells with honest empty states, error and not-found pages, the UI component library on Radix, validation conventions, and Vitest. Also built Settings → Appearance (D-018). Verified: `npm run lint` (clean), `npm run typecheck` (pass), `npm test` (10 files, 75 tests pass), `npm run build` (pass, every route prerendered static), and Playwright checks against `next start` and `next dev` (see *Current implementation state*). Found and fixed during verification: the required-field name ran together ("Name(required)"), the Overview `<title>` skipped the template, the hidden skip link kept its padding, and dark skeletons were invisible.
- **2026-10-28 — Target users reframed.** At the owner's request, PRD.md §4 replaced named personas with activity-based user groups, without names, career stages, or job titles. The summary in this file was updated to match.
- **2026-10-28 — Phase A (bootstrap).** Inspected the empty repository. Wrote all seven project documents, README, `.gitignore`, `.env.example`. Scaffolded Next.js 16.4.3 and replaced the boilerplate with a static bootstrap page. Verified install, lint, typecheck, build, dev, and start.
