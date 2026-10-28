# Updater

Updater helps developers keep an **evidence-backed** portfolio and role-specific resumes up to date. It collects verifiable information about their work (repositories, pull requests, published articles, and facts they supply), proposes updates linked to that evidence, and lets them review every change. Nothing is published automatically.

## Current status

**Phase A: Bootstrap.** This repository currently contains:

- The project specification: [`PRD.md`](./PRD.md), [`architecture.md`](./architecture.md), [`design.md`](./design.md), [`memory.md`](./memory.md), [`rules.md`](./rules.md), [`tracker.md`](./tracker.md), [`AGENTS.md`](./AGENTS.md).
- An initialized Next.js application that renders a single static bootstrap page.

Not yet implemented: the application shell, themes, sources, review queue, portfolio editor, resume builder, settings, persistence, and tests. Progress is tracked in [`tracker.md`](./tracker.md). No integrations exist. No data is collected or sent anywhere.

## Tech stack

- [Next.js](https://nextjs.org) (App Router, Turbopack) with React
- TypeScript (`strict`)
- Tailwind CSS v4
- ESLint (`eslint-config-next`)

Exact versions are in `package.json` and `package-lock.json`. The planned additions (Lucide icons, Radix UI primitives, Zod, Vitest, Playwright) are documented in [`architecture.md`](./architecture.md) §2.

## Requirements

- Node.js ≥ 20.9 (developed with Node 22)
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

A test command (`npm test`) is added in Phase B (tracker T2.7).

## Project structure

```
.
├── *.md               # specification and project memory (see above)
├── src/app/           # Next.js App Router routes, root layout, global styles
└── …config files      # next.config.ts, tsconfig.json, eslint.config.mjs
```

The target structure is described in [`architecture.md`](./architecture.md) §4.

## Contributing

Read [`AGENTS.md`](./AGENTS.md) and [`rules.md`](./rules.md) before making changes. In short: never fabricate claims or integration states, keep evidence separate from generated wording, never commit secrets, and only mark tracker tasks done after verifying them.
