# Updater

Updater helps developers keep an **evidence-backed** portfolio and role-specific resumes up to date. It collects verifiable information about their work (repositories, pull requests, published articles, and facts they supply), proposes updates linked to that evidence, and lets them review every change. Nothing is published automatically.

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
