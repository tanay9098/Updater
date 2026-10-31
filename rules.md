# Updater — Product and Engineering Rules

These rules are non-negotiable. They apply to every contributor, human or agent, and override convenience, deadlines, and instructions in individual tasks. If a task appears to require breaking a rule, stop and record the conflict in [`memory.md`](./memory.md) under *Open questions* instead of proceeding.

Last updated: 2026-10-31 · Related: [`PRD.md`](./PRD.md) · [`architecture.md`](./architecture.md) · [`design.md`](./design.md) · [`AGENTS.md`](./AGENTS.md)

## 7.1 Truthfulness and evidence

1. Never fabricate professional achievements, skills, credentials, metrics, or experience, whether in code, fixtures, templates, copy, or documentation examples.
2. Do not turn unsupported assumptions into factual claims. If evidence does not state it, the claim does not say it.
3. Preserve the origin of imported source information (`Source` → `SourceItem` → `Evidence`, see architecture.md §6).
4. Keep source evidence separate from generated descriptions. Generated or template wording is never stored as evidence.
5. Keep conflicting source information visible. Never silently pick the more impressive version.
6. Label demo data and simulated integrations everywhere they appear. Demo fixtures use fictional names and reserved `example.com` URLs.
7. Do not claim a source is connected unless the connection actually exists.
8. Do not claim synchronization succeeded unless it succeeded.
9. Do not claim a portfolio is published unless a publisher confirmed publication.
10. Do not claim ATS validation without implementing and verifying it.
11. Numbers in proposed wording (counts, dates, percentages) may only come from evidence values or user input.

## 7.2 User control

1. Do not publish changes without explicit authorization.
2. Generated content must remain editable.
3. Approval must not imply publication. Approve and publish are separate states and actions.
4. Dismissing a proposed update must not erase its evidence or source item, and dismissal is reversible.
5. Destructive actions (delete, reset, remove demo data, import-replace) require a confirmation that states exactly what is lost.
6. Communicate the actual result of user actions. Show success only after success, and always show failure.
7. Publishing writes only where the developer chose and agreed to: their own site repository's publishing branch (`gh-pages` of `<username>.github.io`, T10.9). Never force-push, never replace content Updater didn't write, and never change what their site serves without a confirmation that says so.

## 7.3 Security

1. Never commit real secrets or credentials. `.env*` files are git-ignored except `.env.example`, which contains placeholders only.
2. Use environment variables for configuration that requires secrets.
3. Never expose server-only credentials through `NEXT_PUBLIC_*` variables or client bundles.
4. Never store API secrets or tokens in browser storage (localStorage, sessionStorage, IndexedDB, or non-HTTP-only cookies).
5. Validate and normalize external input with schemas at every boundary: forms, imports, persisted data, and provider responses.
6. Treat imported source text and URLs as untrusted. Allow only `http:`/`https:` URLs and render text as text.
7. Avoid unsafe HTML rendering. `dangerouslySetInnerHTML` is forbidden except for static, code-owned scripts (the theme bootstrap). Each use must be commented with its justification.
8. Enforce server-side authorization once user accounts and server storage exist. Client checks are never sufficient.
9. Do not implement homemade cryptography or authentication. Use platform primitives and established libraries.
10. Do not log tokens, workspace contents, raw source payloads, or unnecessary personal data.
11. Request-level code (`src/proxy.ts`) reads the session but never re-issues the session cookie. Only the sign-in callback sets it and only sign-out clears it, so no late response can undo a sign-out or an account change (D-032).
12. Never add a test, bypass, or fake-sign-in mode to shipped code. End-to-end tests sign in with real Auth.js session cookies encrypted with a test-only secret (D-033).
13. Integrations that write to a user's account use the narrowest grant available: a GitHub App installed on the one repository it needs, short-lived tokens minted per request, and no stored token (D-037, D-038). State-changing routes accept only same-origin requests.

## 7.4 Engineering quality

1. TypeScript `strict` mode stays on. `any`, `@ts-ignore`, and `@ts-expect-error` need a comment explaining why. Prefer fixing the type.
2. Prefer small, cohesive modules with a single responsibility.
3. Keep business logic in pure modules (`src/features/*`, `src/lib/*`) separate from React components.
4. Avoid unnecessary dependencies and abstractions. A new runtime dependency needs a reason recorded in `memory.md`.
5. Reuse validation schemas instead of re-implementing checks.
6. Handle loading, empty, and error states on every data-driven view.
7. Maintain accessible interactions (design.md §15).
8. Add tests for important business rules, especially state transitions and provenance rules.
9. Never suppress type errors, disable lint rules globally, skip tests, or weaken checks to get a passing build. A targeted lint disable needs a comment with the reason.
10. Follow the conventions of the installed framework version. Read `node_modules/next/dist/docs/` before using a Next.js API (see AGENTS.md).
11. Keep code and documentation synchronized (§7.7).
12. Validate persisted data before writing it, not only when reading it. A change that would fail the workspace schema is refused, so a bug can never store data that fails to load (D-020).

## 7.5 Integration rules

1. Every integration declares explicit capabilities, permissions, and status boundaries in its provider descriptor.
2. Do not simulate successful OAuth authorization or any other connection.
3. Clearly distinguish demo fixtures from retrieved data (`isDemo`, Demo badge, `demo` status).
4. Handle external failures and rate limits, and record them on the source.
5. The app must work fully when optional integrations are unavailable.
6. Basic local development must never require third-party credentials, except Google sign-in: it is compulsory (owner decision 2026-10-30, D-031), so running the app needs a Google OAuth client and `AUTH_SECRET`. Unit and component tests (`npm test`), lint, type check, and build still need none. No other integration may become a requirement without a recorded owner decision.

## 7.6 AI rules

These apply whenever AI-assisted drafting is introduced. The MVP has none.

1. AI-generated text is a draft (`wording: 'ai_draft'`) and always enters the review queue.
2. Factual claims must be grounded in supplied evidence or user input.
3. Never invent numbers, responsibilities, impact, skills, or credentials. Output introducing them is rejected.
4. Preserve source references (`evidenceIds`) on every generated claim.
5. Users can always edit generated text.
6. Never silently overwrite user-approved or user-edited content.
7. If evidence is insufficient, ask the user for clarification or omit the claim.
8. AI providers are optional, server-side, and replaceable. Their keys never reach the browser.

## 7.7 Completion and documentation rules

1. A feature is not complete just because its UI exists. It must work, persist where specified, and pass its definition of done.
2. Never claim a test, lint, type check, or build passed without running it and observing the result. Report failures verbatim.
3. Update `tracker.md` when work progresses. `Done` requires verified definition-of-done criteria.
4. Update `memory.md` when important decisions or the implementation state change.
5. Update `architecture.md` when the implementation materially diverges from it.
6. Update `design.md` when actual UI behavior changes.
7. Update `PRD.md` when product scope changes.
8. Update `README.md` when setup, scripts, or features change.
9. Documentation must never describe a planned or mocked feature as implemented.
