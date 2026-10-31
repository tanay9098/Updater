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

**Who does what.** Whoever runs an Updater deployment registers **one** GitHub App for it (part 1). Every developer who uses that deployment, including you, then connects their own GitHub account and publishes to their own repository (part 2). Other developers don't create an app or set any variables. Each separate deployment (another domain, or your local `npm run dev`) needs its own app or its own redirect URI on the app, because GitHub only sends developers back to the redirect URIs registered on the app.

### Part 1: once per deployment (the person running Updater)

1. Open GitHub → your profile picture → **Settings** → **Developer settings** → **GitHub Apps** → **New GitHub App** (or go to `https://github.com/settings/apps/new`).
2. **GitHub App name:** any unused name. GitHub turns it into the app's URL name (slug), for example `My Updater` → `my-updater`.
3. **Homepage URL:** your deployment's address, for example `https://<your-domain>`.
4. **Redirect URI** (under "Identifying and authorizing users"; older versions of GitHub's form call it **Callback URL**): `https://<your-domain>/api/github/app/callback`. It must match exactly, so use your production address, not a preview deployment's. To also use the app from `npm run dev`, choose **Add redirect URI** and add `http://localhost:3000/api/github/app/callback`. Leave **Allow wildcard matching** off.
5. Leave **Expire user authorization tokens** as it is. Leave **Request user authorization (OAuth) during installation** and **Enable Device Flow** off, and **Setup URL** empty.
6. **Webhook:** turn **Active** off (it's on by default, and while it's on GitHub requires a Webhook URL). Updater doesn't use webhooks, so leave every event under **Subscribe to events** unticked.
7. **Repository permissions:** Contents: **Read and write**, Pages: **Read and write**, Metadata: **Read-only**. Leave every other repository permission and every account permission at **No access**.
8. **Where can this GitHub App be installed?** Choose **Any account**, so other developers can install it on their own repository. With "Only on this account", only you can publish.
9. Choose **Create GitHub App**. On the app's page, choose **Generate a new client secret** (copy it now: GitHub shows it once), then under **Private keys** choose **Generate a private key** (a `.pem` file downloads).
10. Set these server-only variables in `.env.local`, or in your host's environment settings (on Vercel: Project → Settings → Environment Variables, for the Production environment):

    | Variable | Value |
    | --- | --- |
    | `GITHUB_APP_ID` | The app's numeric **App ID**, at the top of its page |
    | `GITHUB_APP_SLUG` | The app's URL name, as in `github.com/apps/<slug>`: lowercase, not the display name |
    | `GITHUB_APP_CLIENT_ID` | The app's **Client ID** |
    | `GITHUB_APP_CLIENT_SECRET` | The client secret you generated |
    | `GITHUB_APP_PRIVATE_KEY` | The whole `.pem` file, including the `-----BEGIN` and `-----END` lines. On one line, write line breaks as `\n`. |

11. Restart the server. On a host such as Vercel, redeploy: a deployment only gets the variables that existed when it was built.
12. Open the Portfolio page. It should show **Connect GitHub**. If it still says publishing isn't set up on this server, a variable is missing or not in the expected form (check the slug and the private key first). In development, a value in the wrong form is named in the terminal (`[updater] Publishing is off: …`); production logs nothing.

The server needs outbound HTTPS to `api.github.com` and `github.com`. The client secret and private key are credentials: keep them only in `.env.local` or your host's environment settings, never in the repository. Anyone with the private key can write to every repository the app is installed on. If one leaks, generate a new one on the app's page and delete the old one.

### Part 2: once per developer (in the app)

1. Sign in to Updater and build your portfolio.
2. On the Portfolio page choose **Connect GitHub** and authorize the app with **your** GitHub account.
3. On GitHub, create a **public** repository named exactly `<username>.github.io`, with **Add a README** checked so it isn't empty.
4. Install the app: open `https://github.com/apps/<slug>/installations/new`, choose your account, choose **Only select repositories** → `<username>.github.io`, and choose **Install**.
5. Back on the Portfolio page, choose **Check again**, then **Publish**.

The page says "Publishing" while GitHub builds the site and "Published", with the address `https://<username>.github.io/`, once GitHub reports the build. If the repository already has a `gh-pages` branch Updater didn't create, or GitHub Pages serves something else, Updater asks first. If GitHub doesn't let the app turn Pages on, the page tells you to choose Settings → Pages → Deploy from a branch → `gh-pages` → `/ (root)` yourself.

The app can write only to the repository you selected, and the server uses a short-lived token for it each time; you never see the deployment's keys, and its owner gets no access to your other repositories. The connection to your GitHub account is kept in an encrypted cookie in your browser for up to 30 days: in another browser, or after clearing cookies, choose **Connect GitHub** again (you don't need to reinstall the app).

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
