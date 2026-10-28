# Updater — Project Memory

This is the durable context for future development sessions. It records confirmed decisions and the **verified** implementation state. Keep it concise and current. Do not use it as a daily diary.

Last updated: 2026-10-28 (end of Phase A)

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
| Styling | Tailwind CSS v4 + semantic CSS custom properties | Baseline implemented. Full tokens in Phase B. |
| Fonts | System font stacks | Implemented |
| Lint | ESLint 9, `eslint-config-next` | Implemented |
| Icons | lucide-react | Planned (T2.8) |
| Accessible primitives | Radix UI (`radix-ui`) | Planned (T2.8) |
| Validation | Zod | Planned (T2.8) |
| Forms | Controlled components + Zod helpers | Planned |
| Tests | Vitest + Testing Library + jsdom; Playwright for E2E | Planned (T2.7, T9.9) |
| Storage | `localStorage` behind a `WorkspaceStorage` adapter | Planned (T3.3) |

Exact versions live in `package.json` and `package-lock.json`. At Phase A they were: next 16.4.3, react/react-dom 19.3.0, typescript 5.9.3, tailwindcss 4.3.3, eslint 9.39.5.

## Architectural decisions

See the [decision log](#decision-log) below. architecture.md §17 summarizes the same IDs.

## Current implementation state

| Item | State | Verification |
| --- | --- | --- |
| Seven project documents, README, `.gitignore`, `.env.example` | Implemented | Written 2026-10-28. Cross-references checked by hand. |
| Next.js scaffold and configuration | Implemented | lint, typecheck, and build pass. dev and start serve `/` with HTTP 200 (2026-10-28). |
| Root page | Static bootstrap notice only | Rendered in the dev server |
| App shell, themes, components | Not started | none |
| Domain model, storage, store | Not started | none |
| Sources, review queue, portfolio, resumes, settings | Not started | none |
| Tests | No test runner configured yet (T2.7) | none |

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

## Change history

- **2026-10-28 — Target users reframed.** At the owner's request, PRD.md §4 replaced named personas with activity-based user groups, without names, career stages, or job titles. The summary in this file was updated to match.
- **2026-10-28 — Phase A (bootstrap).** Inspected the empty repository. Wrote all seven project documents, README, `.gitignore`, `.env.example`. Scaffolded Next.js 16.4.3 and replaced the boilerplate with a static bootstrap page. Verified install, lint, typecheck, build, dev, and start.
