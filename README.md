# Updater

Updater helps developers keep an **evidence-backed** portfolio and role-specific resumes up to date. It collects verifiable information about their work (repositories, pull requests, published articles, and facts they supply), proposes updates linked to that evidence, and lets them review every change. Nothing is published automatically.

## Current status

**Phase B: Foundation.** This repository currently contains:

- The project specification: [`PRD.md`](./PRD.md), [`architecture.md`](./architecture.md), [`design.md`](./design.md), [`memory.md`](./memory.md), [`rules.md`](./rules.md), [`tracker.md`](./tracker.md), [`AGENTS.md`](./AGENTS.md).
- The application shell: sidebar navigation on wide screens, a top bar with a navigation drawer on narrow screens, a skip link, and page shells for Overview, Sources, Review Queue, Portfolio, Resumes, and Settings.
- Bright (default) and dark themes with a top-bar toggle and a Settings → Appearance control. The choice is saved in this browser and applied before first paint.
- Accessible UI components (buttons, form fields, dialogs, confirmations, menus, tabs, tooltips, status badges, alerts, empty and loading states, toasts) built on Radix UI primitives.
- Validation conventions (`Result` type, Zod helpers, safe external URLs) and a Vitest test suite.

Not yet implemented: workspace storage, sources, the review queue, the portfolio editor, the resume builder, and most of Settings. The page shells say so. Progress is tracked in [`tracker.md`](./tracker.md). No integrations exist. Apart from the theme preference in `localStorage`, no data is stored, and nothing is sent anywhere.

## Tech stack

- [Next.js](https://nextjs.org) (App Router, Turbopack) with React
- TypeScript (`strict`)
- Tailwind CSS v4
- ESLint (`eslint-config-next`)
- Radix UI primitives (`radix-ui`), Lucide icons (`lucide-react`), Zod
- Vitest, Testing Library, and jsdom for unit and component tests

Exact versions are in `package.json` and `package-lock.json`. Playwright end-to-end tests are planned (tracker T9.9).

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

Then open http://localhost:3000.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Create a production build |
| `npm run start` | Serve the production build (run `build` first) |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Generate route types and run the TypeScript compiler without emitting |
| `npm test` | Run the unit and component tests once (Vitest, jsdom) |
| `npm run test:watch` | Run the tests in watch mode |

Tests live next to the code they test (`*.test.ts`, `*.test.tsx`). Query by role and accessible name (`getByRole`) so tests also check accessibility.

## Project structure

```
.
├── *.md               # specification and project memory (see above)
├── src/app/           # routes, root layout, error and not-found pages, design tokens (globals.css)
├── src/components/    # ui/ (primitives), layout/ (shell, navigation), theme/
├── src/lib/           # pure modules: theme rules, navigation, validation, utils
└── …config files      # next.config.ts, tsconfig.json, eslint.config.mjs, vitest.config.mts
```

The target structure is described in [`architecture.md`](./architecture.md) §4.

## Contributing

Read [`AGENTS.md`](./AGENTS.md) and [`rules.md`](./rules.md) before making changes. In short: never fabricate claims or integration states, keep evidence separate from generated wording, never commit secrets, and only mark tracker tasks done after verifying them.
