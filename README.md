# Updater

**In a nutshell:** Updater keeps a developer's portfolio and role-specific resumes up to date from evidence of their actual work. It collects verifiable information (repositories, pull requests, published articles, and facts you supply), proposes updates linked to that evidence, and lets you review every change before it is used. Nothing is published automatically.

## Getting started

### Prerequisites

- Node.js 20.19 or later (developed with Node 22)
- npm

No environment variables, accounts, or external services are needed to run the app locally. All data stays in your browser's `localStorage`.

### Run locally

```bash
git clone https://github.com/tanay9098/Updater.git
cd Updater
npm install
npm run dev
```

Open http://localhost:3000 and choose **Get started**. To explore quickly, pick "Explore with demo data" in the last onboarding step, then approve a few proposals in the Review Queue.

### Useful commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Create a production build |
| `npm run start` | Serve the production build (run `build` first) |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Generate route types and run the TypeScript compiler |
| `npm test` | Run the tests once (Vitest) |
| `npm run test:watch` | Run the tests in watch mode |

Before contributing, read [`AGENTS.md`](./AGENTS.md) and [`rules.md`](./rules.md).
