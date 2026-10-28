# AGENTS.md — Instructions for coding agents

These instructions apply to Claude Code, Codex, and any other coding agent working in this repository. The project documents are the specification. This file sets the working rules and does not repeat them.

## Mandatory reading order

Before substantial work, read:

1. [`PRD.md`](./PRD.md): what to build and the acceptance criteria
2. [`architecture.md`](./architecture.md): layers, domain model, state transitions, contracts
3. [`design.md`](./design.md): UI specification, tokens, accessibility
4. [`memory.md`](./memory.md): confirmed decisions, current verified state, open questions
5. [`rules.md`](./rules.md): non-negotiable rules
6. [`tracker.md`](./tracker.md): tasks, priorities, dependencies, definitions of done

For small fixes, read at least `rules.md`, the relevant tracker task, and the code you are changing.

## Required behavior

- Treat the documentation as the project specification. If code and docs disagree, find out which is right, fix the other, and say so.
- Inspect the actual code before changing it. Do not assume structure from the docs alone.
- Check `git status` first and preserve unrelated work. Do not reformat or rewrite files you are not changing.
- Pick a manageable task from `tracker.md`, respecting its dependencies. Mark it `In Progress` while working.
- Implement working behavior, not only UI placeholders. A screen that does not function is not done.
- Prefer small, testable increments.
- Follow the design system (`design.md`) and layering (`architecture.md` §3). Business logic goes in pure modules, not components.
- Preserve source provenance. Never merge evidence and generated wording.
- Protect credentials and user data (`rules.md` §7.3). Never put secrets in client code, browser storage, or commits.
- Clearly distinguish demo data from real integrations. Never simulate a connection, sync, or publication.
- Run the relevant checks: `npm run lint`, `npm run typecheck`, `npm test` (once configured, T2.7), and `npm run build`.
- Report actual results. Never claim a check passed without running it. Quote failures.
- Update `tracker.md` (verified status only), `memory.md` (decisions and state), and any other doc your change affects (`rules.md` §7.7).
- Explain any deviation from the specification and record it in the relevant document.
- Avoid unnecessary rewrites and dependencies. A new dependency needs a reason in `memory.md`.
- The project owner reviews each execution phase (A–E in `tracker.md`) before the next begins. Do not start the next phase without approval.

## Framework note

This project uses a recent Next.js release (see `package.json`). Its APIs and defaults (Cache Components, Turbopack, typed `LayoutProps`/`PageProps`) may differ from what you remember. Read the relevant guide in `node_modules/next/dist/docs/` before using a framework API. The block below is managed by Next.js (`next dev` re-adds it). Keep it.

## Commands

```bash
npm install          # install dependencies
npm run dev          # development server at http://localhost:3000
npm run lint         # ESLint
npm run typecheck    # next typegen + tsc --noEmit
npm run build        # production build
npm run start        # serve the production build
```

## Completion report

At the end of each task, report:

1. What changed.
2. Which files were affected.
3. Which checks were run.
4. Actual test and build outcomes (pass or fail, with relevant output).
5. Known limitations and anything simulated.
6. The recommended next task from `tracker.md`.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
