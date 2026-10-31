# Updater

Updater helps developers keep an **evidence-backed** portfolio and role-specific resumes up to date. It collects verifiable information about their work (repositories, pull requests, published articles, and facts they supply), proposes updates linked to that evidence, and lets them review every change. Nothing is published automatically: publishing to your own GitHub Pages site happens only when you choose it.

## Tech stack

- [Next.js](https://nextjs.org) (App Router, Turbopack, Cache Components) with React
- TypeScript (`strict`)
- Tailwind CSS v4
- ESLint (`eslint-config-next`)
- Radix UI primitives (`radix-ui`), Lucide icons (`lucide-react`), Zod
- Auth.js (`next-auth` v5) for Google sign-in (required)
- Vitest, Testing Library, and jsdom for unit, component, and integration tests
- Playwright and axe-core for end-to-end and automated accessibility tests

Exact versions are in `package.json` and `package-lock.json`.

## Requirements

- Node.js ≥ 20.19 (developed with Node 22). The test tooling (Vite 8, jsdom 28) needs 20.19 or later.
- npm (a `package-lock.json` is committed)

- A Google OAuth client and an `AUTH_SECRET`. Sign-in with Google is required to use Updater; see below. (`npm test`, `npm run lint`, `npm run typecheck`, and `npm run build` need no credentials.)

## Google sign-in (required)

Every page requires a Google account, and each account gets its own workspace: a portfolio and resumes built only from that account's data. There is no separate sign-up; the first sign-in creates the account. There is no way to use the app without signing in.

1. In Google Cloud Console, create an OAuth client ID of type **Web application**, with the authorized redirect URI `http://localhost:3000/api/auth/callback/google` (add your production origin's `/api/auth/callback/google` too).
2. Copy `.env.example` to `.env.local` and set `AUTH_SECRET` (for example `openssl rand -base64 33`), `AUTH_GOOGLE_ID`, and `AUTH_GOOGLE_SECRET`. When self-hosting with `npm run start`, also set `AUTH_TRUST_HOST=true` or `AUTH_URL`.
3. Restart the dev server and open http://localhost:3000. You're sent to `/sign-in`.

Until all three variables are set, every page redirects to `/sign-in`, which says sign-in isn't available (and, in development, which variables are missing). The workspace itself still lives in the browser, stored under the signed-in account; it doesn't follow the account to another device (export and import move it). A workspace created before sign-in became required can be moved into an account from **Settings → Account**.

## GitHub import (optional)

**Sources → GitHub → Import repositories** lists the public repositories a GitHub user or organization owns and imports the ones you choose as evidence with proposals for review. It needs no GitHub sign-in: Updater's server reads GitHub's public API, so the server needs outbound HTTPS access to `api.github.com`. Updater can't confirm an account is yours, so import only your own.

Without a token, GitHub allows 60 requests per hour from the server's IP address, shared by all users (one import uses 1–3). To raise that to 5,000, set `GITHUB_TOKEN` in `.env.local` to a fine-grained token with no repository access or permissions, and restart the server. The token stays on the server.

## Publishing to GitHub Pages (optional)

Publishing puts your portfolio on **your own** GitHub Pages site, `https://<username>.github.io/`. The site is a static site in a repository in your GitHub account. Updater writes to it only when you choose **Publish**, and only to its `gh-pages` branch. If you disconnect Updater or uninstall its app, the site stays online and stays yours. Without the setup below, the Portfolio page says publishing isn't set up on this server and everything else works as usual.

**Once per deployment (the person running Updater):** register a GitHub App in GitHub → Settings → Developer settings → GitHub Apps → **New GitHub App**:

- **Callback URL:** `https://<your-domain>/api/github/app/callback` (for local development, `http://localhost:3000/api/github/app/callback`). Leave "Request user authorization (OAuth) during installation" off.
- **Webhook:** turn **Active** off. Updater doesn't use webhooks.
- **Repository permissions:** Contents: **Read and write**, Pages: **Read and write**, Metadata: **Read-only**. No account permissions.
- **Where can this GitHub App be installed?** Any account, so other developers can install it on their own repository.
- After creating it, generate a **client secret** and a **private key**.

Then set these server-only variables (in `.env.local`, or in your host's environment settings) and restart:

| Variable | Value |
| --- | --- |
| `GITHUB_APP_ID` | The app's numeric App ID |
| `GITHUB_APP_SLUG` | The app's URL name, as in `github.com/apps/<slug>` |
| `GITHUB_APP_CLIENT_ID` | The app's Client ID |
| `GITHUB_APP_CLIENT_SECRET` | A client secret you generated |
| `GITHUB_APP_PRIVATE_KEY` | The contents of the downloaded `.pem` file. On one line, write line breaks as `\n`. |

The server needs outbound HTTPS to `api.github.com` and `github.com`.

**Once per developer (in the app):** on the Portfolio page choose **Connect GitHub** and authorize the app. Create a **public** repository named `<username>.github.io` with a README, install the app with "Only select repositories" → that repository, and choose **Check again**. Then **Publish**. The page says "Publishing" while GitHub builds the site and "Published", with the address, once GitHub reports the build. If the repository already has a `gh-pages` branch Updater didn't create, or GitHub Pages serves something else, Updater asks first. If GitHub doesn't let the app turn Pages on, the page tells you to choose Settings → Pages → Deploy from a branch → `gh-pages` → `/ (root)` yourself.

What is published is what the preview shows: never your email address or demo data. The repository also gets `portfolio.json` with the same content as data.

## Getting started

```bash
npm install
```

```bash
npm run dev
```

Set up Google sign-in first (above). Then open http://localhost:3000, sign in with Google, and choose **Get started**. To explore quickly, pick "Explore with demo data" in the last step, then approve a few proposals in the Review Queue.

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
| `npm run test:e2e` | Run the end-to-end and accessibility tests (Playwright, Chromium) against the production build |

Tests live next to the code they test (`*.test.ts`, `*.test.tsx`); shared fixtures and render helpers are in `src/test/`. Query by role and accessible name (`getByRole`) so tests also check accessibility.

End-to-end tests live in `e2e/` and need no Google account or `.env.local`. They start `next start` on port 3100 with a dummy Google client and a test-only `AUTH_SECRET`, and sign in by setting a session cookie encrypted with that secret. Build first, and install the browser once if your machine doesn't have it:

```bash
npx playwright install chromium
```

```bash
npm run build && npm run test:e2e
```

## Project structure

```
.
├── *.md               # specification and project memory (see AGENTS.md for the reading order)
├── src/app/           # (workspace)/ pages with the app shell, sign-in/, api/ (Auth.js, account status, GitHub listing, GitHub Pages publishing), root layout, design tokens
├── src/auth.ts        # Auth.js setup (Google), server-only
├── src/proxy.ts       # sign-in gate on every request
├── src/components/    # ui/ (primitives), layout/, theme/, account/, workspace/ (store bindings, badges), and one folder per page
├── src/features/      # pure domain logic: workspace store, review transitions, proposals, ingestion, portfolio, resumes
├── src/lib/           # validation schemas, storage adapter, auth rules, demo fixtures, provider registry and GitHub client, GitHub Pages publisher, utilities
├── src/types/         # domain types inferred from the schemas
├── e2e/               # Playwright end-to-end and accessibility tests
└── …config files      # next.config.ts, tsconfig.json, eslint.config.mjs, vitest.config.mts, playwright.config.ts
```

The architecture, including how evidence, generated wording, review state, and publishing state are kept separate, is described in [`architecture.md`](./architecture.md).
