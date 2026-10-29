# Updater

Updater helps developers keep an **evidence-backed** portfolio and role-specific resumes up to date. It collects verifiable information about their work (repositories, pull requests, published articles, and facts they supply), proposes updates linked to that evidence, and lets them review every change. Nothing is published automatically.

## Current status

**Phase C: core functionality, awaiting owner review.** The local MVP works end to end in the browser, without accounts, credentials, or network services.

What works:

- **Onboarding** (`/onboarding`): a three-step setup. Add your name, then start with your own entries, fictional demo data, or nothing.
- **Overview**: profile checklist, source statuses, pending proposals, recent evidence, your recent changes, and one recommended next action. Every number is a count of stored records.
- **Sources**: add manual entries (project, article or talk, contribution, achievement). Each becomes a source item, a user-supplied statement, and a proposal. Load or remove the clearly labeled demo workspace. GitHub and blog feeds are listed as **Planned**, with the permissions they will need, and have no connect button.
- **Review Queue**: filter by status, inspect evidence and provenance, edit wording (the original is kept), approve (conflicting evidence needs an explicit acknowledgement), dismiss with an optional reason (evidence is kept), restore, and revert edits.
- **Portfolio**: edit profile, links, skills, projects (add, edit, reorder, hide, delete), and achievements with origin badges and evidence. A local preview is labeled "Local preview: not published". Publish is disabled because no publisher exists.
- **Resumes**: drafts per target role; select approved projects, achievements, and skills; per-resume wording that never changes the portfolio; your own summary; keyword-based selection suggestions; preview; and "Print / Save as PDF" through the browser.
- **Settings**: profile basics, theme, integration summary, privacy details, JSON export and import, remove demo data, restart onboarding, and reset (all destructive actions ask for confirmation).
- Bright (default) and dark themes, a responsive shell, keyboard-accessible components, and a save status that reports the real outcome ("Saved locally · 14:02" or "Not saved" with a retry).

**Demo vs real.** Demo data is fictional, labeled "Demo data" everywhere, and links only to example.com. No external integration exists: nothing is fetched, synchronized, or published, and the UI never claims otherwise. Manual entries are the only real source, and they are stored locally.

Progress is tracked in [`tracker.md`](./tracker.md); decisions and verified state are in [`memory.md`](./memory.md).

## Data and privacy

- Everything is stored in this browser's `localStorage` (`updater:workspace:v1`, plus `updater:theme`). Nothing is sent to a server. There are no analytics.
- No tokens, passwords, or API keys are stored; the persisted schema rejects unknown fields.
- Stored data is validated on every load. If it can't be read, the app offers to export the raw data or reset instead of crashing.
- Data is per browser and per device. Clearing site data deletes it, so use **Settings → Export workspace** for backups.

## Known limitations

- No real integrations (GitHub and RSS are planned), no accounts, no server storage, no publishing.
- No generated PDF: printing uses the browser's print dialog and a print stylesheet. No compatibility with applicant tracking systems is claimed or checked.
- Proposals come from fixed templates over evidence fields (no AI). Conflicts are detected only within a single source item.
- End-to-end tests were run as one-off Playwright scripts; a committed `e2e/` suite is planned (tracker T9.9).

## Tech stack

- [Next.js](https://nextjs.org) (App Router, Turbopack, Cache Components) with React
- TypeScript (`strict`)
- Tailwind CSS v4
- ESLint (`eslint-config-next`)
- Radix UI primitives (`radix-ui`), Lucide icons (`lucide-react`), Zod
- Vitest, Testing Library, and jsdom for unit, component, and integration tests

Exact versions are in `package.json` and `package-lock.json`.

## Requirements

- Node.js ≥ 20.19 (developed with Node 22). The test tooling (Vite 8, jsdom 28) needs 20.19 or later.
- npm (a `package-lock.json` is committed)

No environment variables, accounts, or external services are required. See [`.env.example`](./.env.example) for names reserved for future integrations.

## Getting started

```bash
npm install
```

```bash
npm run dev
```

Then open http://localhost:3000 and choose **Get started**. To explore quickly, pick "Explore with demo data" in the last step, then approve a few proposals in the Review Queue.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Create a production build |
| `npm run start` | Serve the production build (run `build` first) |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Generate route types and run the TypeScript compiler without emitting |
| `npm test` | Run the unit, component, and integration tests once (Vitest, jsdom) |
| `npm run test:watch` | Run the tests in watch mode |

Tests live next to the code they test (`*.test.ts`, `*.test.tsx`); shared fixtures and render helpers are in `src/test/`. Query by role and accessible name (`getByRole`) so tests also check accessibility.

## Project structure

```
.
├── *.md               # specification and project memory (see AGENTS.md for the reading order)
├── src/app/           # routes, root layout, error and not-found pages, design tokens and print styles (globals.css)
├── src/components/    # ui/ (primitives), layout/, theme/, workspace/ (store bindings, badges), and one folder per page
├── src/features/      # pure domain logic: workspace store, review transitions, proposals, ingestion, portfolio, resumes
├── src/lib/           # validation schemas, storage adapter, demo fixtures, provider registry, utilities
├── src/types/         # domain types inferred from the schemas
└── …config files      # next.config.ts, tsconfig.json, eslint.config.mjs, vitest.config.mts
```

The architecture, including how evidence, generated wording, review state, and publishing state are kept separate, is described in [`architecture.md`](./architecture.md).

## Contributing

Read [`AGENTS.md`](./AGENTS.md) and [`rules.md`](./rules.md) before making changes. In short: never fabricate claims or integration states, keep evidence separate from generated wording, never commit secrets, and only mark tracker tasks done after verifying them.
