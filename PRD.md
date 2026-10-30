# Updater — Product Requirements Document

## 1. Document control

| Field | Value |
| --- | --- |
| Product | Updater — developer portfolio auto-updater |
| Purpose | Defines what Updater must do, for whom, and how the MVP is judged usable. It is the product source of truth for humans and coding agents. |
| Version | 0.1.0 (initial specification) |
| Current phase | Phase C — Core functionality complete, awaiting owner review (see [`tracker.md`](./tracker.md)) |
| Last updated | 2026-10-29 |
| Status | Draft, pending owner review |

Related documents:

- [`architecture.md`](./architecture.md): technical architecture and domain model
- [`design.md`](./design.md): UI/UX specification for the Updater application
- [`memory.md`](./memory.md): durable project memory and decision log
- [`rules.md`](./rules.md): non-negotiable product and engineering rules
- [`tracker.md`](./tracker.md): prioritized implementation roadmap
- [`AGENTS.md`](./AGENTS.md): working instructions for coding agents
- [`README.md`](./README.md): setup and scripts

Requirement keywords: **MUST** is required for the MVP; **SHOULD** is expected unless a documented reason prevents it; **MAY** is optional.

## 2. Executive summary

Updater helps developers keep an accurate, evidence-backed professional profile without maintaining every document by hand. It collects verifiable information about a developer's work: repositories, open-source pull requests, published technical articles, and facts the developer supplies directly. It records where each fact came from, proposes portfolio and resume updates based on those facts, and lets the developer edit, approve, or dismiss every proposal before it is used.

Updater serves developers whose professional evidence is scattered across platforms and documents that drift out of date. That includes developers who build their own projects, contribute to repositories they don't own, publish technical writing, maintain several resumes, or present work that isn't public.

A conventional static portfolio generator turns whatever text it is given into an attractive page. Updater instead maintains a **structured model of a developer's professional work**:

- **Source items** (a repository, a pull request, an article) are stored with their origin.
- **Evidence** (facts drawn from source items or stated by the user) is kept separate from wording.
- **Claims** (the sentences that appear in a portfolio or resume) link back to the evidence that supports them.
- **Review state** records whether a human has accepted each claim.
- **Publishing state** records whether anything has actually been published.

The portfolio and each resume are views over that model. The model can answer "where did this sentence come from?", and Updater never publishes or embellishes on the developer's behalf.

## 3. Problem statement

1. **Portfolios go stale.** Developers finish projects, merge pull requests, and publish articles, then forget to update their portfolio. The portfolio stops reflecting their actual work.
2. **Evidence is scattered.** Achievements live across GitHub, blogging platforms, issue trackers, and personal notes. No single place holds a complete, trustworthy record.
3. **Maintenance is repetitive.** The same project is described in a portfolio, a general resume, and several tailored resumes, and each copy is edited by hand.
4. **Tailoring takes time.** Producing a resume emphasizing the right projects for a backend, frontend, or developer-relations role means re-selecting and rewording content every time.
5. **AI writing tools embellish.** Generic AI tools invent metrics ("improved performance by 40%"), responsibilities, and technologies. Developers either remove these by hand or present unverifiable claims to employers.
6. **Provenance gets lost.** Months later, developers often cannot say which repository, pull request, or article supports a claim on their resume.

## 4. Target users

Target users are defined by the work Updater must support. They are not defined by name, career stage, or job title. One developer may belong to several of these groups.

### 4.1 Developers whose work is spread across several platforms

- **Goals:** build an accurate portfolio from repositories, articles, and personal notes kept in different places, and produce a resume from it.
- **Pain points:** unsure which work is worth including; tempted to overstate what a project involved; little time to polish several documents.
- **Use cases:** load repositories and notes, review suggested project descriptions, approve the accurate ones, and print a one-page resume.

### 4.2 Developers contributing to repositories they don't own

- **Goals:** show merged upstream pull requests next to their own projects, with links reviewers can verify.
- **Pain points:** contributions are spread across many repositories owned by others; summarizing a pull request accurately months later is hard.
- **Use cases:** review proposals created from merged pull requests, open the original pull request from the review queue, and edit the wording before approving.

### 4.3 Developers who publish technical writing

- **Goals:** list recent articles and talks on their portfolio without editing it by hand each time, and use that writing as evidence of expertise.
- **Pain points:** each new article means a manual portfolio edit; article metadata (title, date, URL) gets copied wrongly.
- **Use cases:** add articles as evidence, approve the proposed portfolio entries, and select writing-focused achievements for a resume aimed at a writing-heavy role.

### 4.4 Developers maintaining several versions of their resume

- **Goals:** keep several role-specific resumes consistent with one underlying record.
- **Pain points:** resumes diverge; an update to one is never copied to the others; old claims linger after they stop being accurate.
- **Use cases:** create resume drafts per target role from the same approved claims, and edit a summary per role without changing the source facts.

### 4.5 Developers presenting work that isn't publicly verifiable

- **Goals:** present the most relevant projects to each audience, including client or confidential work that has no public source.
- **Pain points:** the work has no public repository or article to link to; it must be described truthfully without exposing confidential details.
- **Use cases:** add such projects as user-supplied statements marked as such, choose which projects appear in each resume, and keep confidential projects out of the public portfolio.

## 5. Product goals

1. **Reduce repetitive portfolio maintenance.** New evidence becomes a reviewable proposal instead of a manual editing task.
2. **Centralize professional evidence.** Source items and evidence from all supported sources live in one structured workspace.
3. **Make factual claims verifiable.** Every factual claim links to its evidence, and to the original source where one exists.
4. **Reduce effort for role-specific resumes.** A tailored resume is a selection and light rewording of approved content, not a rewrite.
5. **Give users explicit control.** Nothing enters a portfolio or resume without review, and nothing is published without an explicit action.
6. **Separate sourced facts from generated descriptions.** The interface always shows whether wording came from a source, the user, a template, or (in future) an AI draft.

Numerical targets are not set at this stage because there is no usage data to support them. Section 14 lists **hypothesis metrics** to validate once the product has users.

## 6. Non-goals

The MVP is not intended to:

- Fabricate experience, credentials, skills, or metrics.
- Guarantee employment or interviews.
- Apply for jobs automatically.
- Publish changes without explicit approval.
- Replace GitHub, blogging platforms, or other source platforms.
- Require an AI provider for basic functionality.
- Depend on paid third-party services to run locally.
- Claim ATS (applicant tracking system) compliance without an actual implementation and validation.
- Provide a developer social network, feeds, or following.
- Host or deploy a public portfolio website. This is future scope (§12) and is presented only as unavailable.

## 7. Core user journeys

Each journey lists the steps, the expected system behavior, and the observable outcome used in testing. Requirement IDs refer to §8.

### Journey A — Getting started

1. **Open Updater.** With an empty workspace, the user lands on the onboarding screen (`/onboarding`). The app never shows a populated dashboard to a first-time user unless they chose demo data.
2. **Understand the product.** One short screen explains: Updater collects evidence, proposes updates, the user reviews them, and nothing is published automatically. It states that data is stored only in this browser in the MVP.
3. **Set up a basic profile.** The user enters a name (required) and headline (optional). Other profile fields are deferred to the portfolio editor. Validation errors appear beside the field (FR-PROF-01, FR-ERR-01).
4. **Choose a source or continue with demo data.** Three options: add evidence manually; load the clearly labeled demo workspace; skip for now. Planned integrations (GitHub, blogs) are listed as planned, not as connectable (FR-SRC-01).
5. **View the dashboard.** The user reaches the Overview, which shows profile completeness, sources and their honest states, pending review items, and one recommended next action (FR-DASH-01).

*Observable outcome:* after reloading, the profile and the user's choice are still present (FR-DATA-01), and demo content carries a visible "Demo data" label everywhere it appears (FR-SRC-03).

### Journey B — Connecting sources

1. **Visit Sources** (`/sources`).
2. **Select an integration.** Each provider card shows its name, what it provides, and its state: Connected, Not connected, Needs attention, Syncing, Unavailable, Planned, or Demo data.
3. **Understand permissions and capabilities.** Before any connection, the card lists what will be read and what will never be done (for example, "Read public repositories. Never writes to your account.").
4. **Connect.** The user connects only through a genuinely supported flow. In the MVP:
   - **Manual entries:** always available locally. The user adds a source item (project, article, contribution, achievement) with an optional URL, and Updater creates evidence marked "User-supplied".
   - **Demo workspace:** loads labeled fixture data. It is never described as connected to a real account.
   - **GitHub, blogs:** shown as **Planned**, with setup notes describing the future flow. There is no connect button that pretends to work.
5. **Review retrieved items.** Items from a source are listed under it with title, kind, date, and URL.
6. **Understand synchronization status and failures.** Where a provider supports syncing, the last attempt time and result (succeeded, failed with reason, rate-limited) are shown. Providers that do not sync say "Not synchronized: entries are added manually."

*Observable outcome:* no provider ever displays "Connected" unless a connection exists. For the MVP, only Manual entries can be in a usable state, and it is described as local.

### Journey C — Reviewing a proposed update

1. **Open the review queue** (`/review`). The default filter is "Needs review". The page states counts per status.
2. **Inspect the proposal.** Each item shows the proposed claim or project description, its kind (new project, new claim, new skill), and who wrote the wording (template, user, or AI draft in future).
3. **Read the evidence.** The item shows the evidence statements, verification state, source name and type, and discovery date.
4. **Open the original source.** A link opens the source URL in a new tab when one exists and passes URL validation. Demo items link only to reserved `example.com` addresses and say so.
5. **Edit, approve, or dismiss.**
   - *Edit* opens the wording for editing. Saving changes the status to **Edited**, and the original proposed text is preserved for comparison.
   - *Approve* moves the item to **Approved** and adds the content to the portfolio draft as an approved claim or project linked to its evidence.
   - *Dismiss* moves the item to **Dismissed**, with an optional reason. Its evidence stays in the workspace, and the item can be restored.
6. **Confirm the resulting state.** A status message announced to screen readers confirms the action only after the state change has been applied and saved. The item moves to the matching filter.

*Observable outcome:* after reload, statuses persist. Approved items appear in the portfolio editor with an evidence link. Dismissed items' evidence is still visible under Sources.

### Journey D — Maintaining a portfolio

1. **Open the portfolio editor** (`/portfolio`).
2. **Edit content:** name, headline, introduction, external links, skills, and projects (add, edit, reorder, hide).
3. **Review source-backed claims.** Each project's claims show their origin badge (Source, User-supplied, Edited from source) and an evidence popover with source links.
4. **Preview.** The preview pane renders the portfolio as a visitor would see it, labeled "Local preview: not published."
5. **Save the draft.** Edits save to the local draft. The editor shows "Saved locally at {time}" or a persistence error, never a false success.
6. **Publish.** The Publish control states that no publisher is configured in this version and is disabled. Publication state stays "Not published" (FR-PUB-01).

### Journey E — Creating a resume

1. **Choose a target role** (`/resumes` → "New resume"). The user enters a role title such as "Backend Engineer" and an optional resume name.
2. **Select content.** Checklists of approved projects, approved claims, and skills. Each claim shows its evidence badge. Items lacking approval are not offered, or are clearly marked "not yet approved" and cannot be added.
3. **Edit the summary and descriptions.** The resume summary and per-resume wording overrides are editable. Overrides never change the underlying evidence or portfolio claim.
4. **Preview.** A print-styled preview shows the resume.
5. **Save the draft.** It saves to local storage with a visible saved state.
6. **Export or print.** "Print / Save as PDF" opens the browser print dialog using a print stylesheet. The UI does not claim ATS compatibility.

## 8. Functional requirements

Priorities: **P0** is required for the MVP, **P1** is expected in the MVP if feasible, and **P2** is post-MVP.

### 8.1 Profile management

| ID | Priority | Requirement | Acceptance criteria |
| --- | --- | --- | --- |
| FR-PROF-01 | P0 | The user can create and edit a developer profile: name, headline, introduction, location (optional), and external links. | Fields are editable in onboarding and the portfolio editor. The name is required (1–100 chars). Invalid URLs show an inline error. Saved values persist after reload. |
| FR-PROF-02 | P1 | The app computes profile completeness from observable fields. | Overview shows which profile fields are missing (for example "Add an introduction"), not an invented score. |
| FR-PROF-03 | P0 | The profile stores only what the user enters. | No hidden fields are populated, and nothing is sent to a server. |

### 8.2 Source discovery and connection

| ID | Priority | Requirement | Acceptance criteria |
| --- | --- | --- | --- |
| FR-SRC-01 | P0 | The Sources page lists every known provider with an honest state. | Each provider shows one of: Connected, Not connected, Needs attention, Syncing, Unavailable, Planned, Demo data. GitHub and blog providers show Planned. No provider shows Connected without a real connection. |
| FR-SRC-02 | P0 | Each provider describes its capabilities, the data it reads, and its permissions before connection. | Provider cards display capability and permission lists sourced from the provider definition. |
| FR-SRC-03 | P0 | Demo data is labeled wherever it appears. | Every demo source item, evidence item, review item, and derived claim shows a "Demo data" label on Sources, Review Queue, Portfolio, Resumes, and Overview. |
| FR-SRC-04 | P0 | Users can add manual source items (project, article, contribution, achievement) with title, optional URL, date, and description. | The new item appears under Manual entries. Evidence marked "User-supplied" is created, and a review item is proposed. |
| FR-SRC-05 | P1 | Users can remove the demo workspace or disconnect a source. | A confirmation explains the consequences. Derived review items are removed. Approved claims derived from it are either removed or kept and marked "source removed" according to the user's choice. |

### 8.3 Source ingestion and synchronization

| ID | Priority | Requirement | Acceptance criteria |
| --- | --- | --- | --- |
| FR-SYNC-01 | P0 | Ingested data is validated and normalized before storage. | Items failing schema validation are rejected with a recorded reason and are not partially stored. |
| FR-SYNC-02 | P1 | Providers that sync record the last attempt, result, and error. | Sources shows last-attempt time and outcome. Failures show a readable reason and a retry action. |
| FR-SYNC-03 | P2 | Real providers handle pagination and rate limits. | Rate-limit responses pause sync and show when it can resume. Covered by the GitHub integration tasks in Phase 10. |
| FR-SYNC-04 | P0 | Re-importing the same external item does not duplicate it. | Items are de-duplicated by `(sourceId, externalId)`. |

### 8.4 Evidence storage and provenance

| ID | Priority | Requirement | Acceptance criteria |
| --- | --- | --- | --- |
| FR-EVID-01 | P0 | Every evidence record references its source item, capture time, and verification state. | The evidence model has a required `sourceItemId`, `capturedAt`, and `verification`. Validation rejects records without them. |
| FR-EVID-02 | P0 | Every portfolio claim records its origin (source, user, edited from source) and the evidence IDs supporting it. | A claim without evidence can exist only with origin `user` and is labeled "User-supplied". |
| FR-EVID-03 | P0 | Generated or template wording is never treated as evidence. | Claims reference evidence; evidence never references claims as its support. |
| FR-EVID-04 | P1 | Conflicting evidence is preserved and shown. | Evidence marked `conflicting` shows a warning on the review item and cannot be approved without the user acknowledging the conflict. |

### 8.5 Review queue management

| ID | Priority | Requirement | Acceptance criteria |
| --- | --- | --- | --- |
| FR-REV-01 | P0 | The review queue lists proposals with claim text, source, evidence summary, URL, discovery date, verification state, and review state. | All listed fields are visible or one interaction away. |
| FR-REV-02 | P0 | The queue can be filtered by status: Needs review, Edited, Approved, Dismissed. | The filter changes the list and shows a count per status. |
| FR-REV-03 | P0 | Review status follows defined transitions only (see `architecture.md` §7.1). | Unit tests cover every allowed transition and reject disallowed ones. |

### 8.6 Editing and approving generated content

| ID | Priority | Requirement | Acceptance criteria |
| --- | --- | --- | --- |
| FR-EDIT-01 | P0 | Proposed wording can be edited before approval. | Saving an edit sets status to Edited and retains the original proposal text. |
| FR-EDIT-02 | P0 | Approval incorporates content into the portfolio draft. | The approved claim or project appears in the portfolio editor, linked to its evidence. |
| FR-EDIT-03 | P0 | Dismissal preserves evidence and is reversible. | A dismissed item can be restored to Needs review, and its evidence remains. |
| FR-EDIT-04 | P0 | Approval never implies publication. | After approval, the publication state is unchanged. |
| FR-EDIT-05 | P1 | Approved claims stay editable in the portfolio editor. | Editing an approved claim changes its origin to "Edited from source" when it has evidence, and keeps its evidence links. |

### 8.7 Portfolio editing and preview

| ID | Priority | Requirement | Acceptance criteria |
| --- | --- | --- | --- |
| FR-PORT-01 | P0 | The portfolio editor lets users edit profile fields, skills, projects, claims, and links. | All edits persist after reload. |
| FR-PORT-02 | P0 | Projects can be added, edited, reordered, hidden, and deleted (with confirmation). | Each action updates the preview immediately and persists. |
| FR-PORT-03 | P0 | A preview renders the portfolio and is labeled as a local preview. | The preview header reads "Local preview: not published". |
| FR-PORT-04 | P0 | Claims in the editor show origin and evidence. | Each claim shows an origin badge and opens its evidence list. |

### 8.8 Portfolio publishing controls

| ID | Priority | Requirement | Acceptance criteria |
| --- | --- | --- | --- |
| FR-PUB-01 | P0 | Publishing is a separate, explicit action, shown as unavailable in the MVP. | The Publish control is disabled with an explanation. Publication state is "Not published". No UI claims a public URL. |
| FR-PUB-02 | P2 | A future publisher reports status, URL, failures, and rollback. | Defined in `architecture.md` §13 and implemented in Phase 10. |

### 8.9 Resume creation and tailoring

| ID | Priority | Requirement | Acceptance criteria |
| --- | --- | --- | --- |
| FR-RES-01 | P0 | Users can create multiple resume drafts, each with a target role. | Drafts are listed with name, role, and last-saved time, and can be renamed, duplicated, and deleted (with confirmation). |
| FR-RES-02 | P0 | Users select approved projects, claims, and skills per resume. | Only approved content is selectable. Selections persist per draft. |
| FR-RES-03 | P0 | Users edit a per-resume summary and per-resume wording overrides. | Overrides do not change the portfolio claim or its evidence. |
| FR-RES-04 | P0 | A print-friendly preview and browser print workflow. | "Print / Save as PDF" triggers `window.print()`. The print stylesheet hides app chrome and fits A4/Letter. |
| FR-RES-05 | P1 | Role-based suggestions for which approved items to include. | Suggestions are based on keyword overlap between the target role and the item's technologies and text. They only pre-select items and never add new text. |

### 8.10 Data persistence

| ID | Priority | Requirement | Acceptance criteria |
| --- | --- | --- | --- |
| FR-DATA-01 | P0 | The workspace persists locally in the browser. | Profile, sources, evidence, review state, portfolio, and resumes survive reload. |
| FR-DATA-02 | P0 | Persisted data is versioned and validated on load. | Corrupt or incompatible data does not crash the app. The user sees a recovery message with options to export the raw data or reset. |
| FR-DATA-03 | P0 | No credentials or API secrets are stored in browser storage. | Code review and a test confirm the persisted schema contains no token fields. |
| FR-DATA-04 | P1 | Users can export the workspace as JSON and import it back. | Import validates the file and reports errors without overwriting existing data on failure. |

### 8.11 Theme preferences

| ID | Priority | Requirement | Acceptance criteria |
| --- | --- | --- | --- |
| FR-THEME-01 | P0 | Bright mode is the default. Dark mode is selectable. | A first visit renders bright mode regardless of OS preference. The toggle switches themes. |
| FR-THEME-02 | P0 | The theme preference persists without a flash of the wrong theme. | After choosing dark and reloading, the first paint is dark. |
| FR-THEME-03 | P0 | The theme control is accessible. | It has an accessible name and state, and works by keyboard. |

### 8.12 Settings and privacy

| ID | Priority | Requirement | Acceptance criteria |
| --- | --- | --- | --- |
| FR-SET-01 | P0 | Settings exposes profile basics, theme, integration status summary, privacy information, and local data management. | All sections are present and functional. |
| FR-SET-02 | P0 | Destructive actions require confirmation. | Reset workspace, remove demo data, and delete resume use a confirmation dialog naming what is lost. |
| FR-SET-03 | P0 | Privacy information accurately describes the MVP's data handling. | The text states that data stays in this browser, nothing is sent to Updater servers, and there are no analytics. |

### 8.12a Accounts and sign-in (optional, post-MVP — T10.5)

| ID | Priority | Requirement | Acceptance criteria |
| --- | --- | --- | --- |
| FR-AUTH-01 | P2 | When an installation configures Google sign-in, every page requires a signed-in account. The first sign-in creates the account. | Signed-out requests to pages redirect to `/sign-in` and back after signing in; API requests get 401. Partly configured sign-in blocks the app instead of falling back to local mode. |
| FR-AUTH-02 | P2 | Each account's portfolio and resumes are built only from that account's workspace. | On one browser, a second account sees none of the first account's profile, projects, claims, or resumes, and the first account's data is intact when it signs back in. No workspace opens while the account is unknown or signed out. |
| FR-AUTH-03 | P2 | Without sign-in configuration the app works exactly as the local MVP. | No credentials are needed for `npm run dev`; the local workspace key is unchanged. |
| FR-AUTH-04 | P2 | A workspace saved before sign-in was turned on is never given to an account automatically. | Settings → Account offers to move it into the signed-in account after a confirmation that names what is replaced; the unowned copy is then removed. |

### 8.13 Error handling and recovery

| ID | Priority | Requirement | Acceptance criteria |
| --- | --- | --- | --- |
| FR-ERR-01 | P0 | Validation errors appear beside the relevant field and are announced to assistive technology. | Inputs use `aria-invalid` and `aria-describedby` linked to the message. |
| FR-ERR-02 | P0 | Persistence failures (quota exceeded, storage unavailable) are reported. | The user sees "Changes could not be saved", with the reason. Unsaved edits remain in memory. |
| FR-ERR-03 | P0 | Route-level errors show a recoverable error screen. | The Next.js `error.tsx` boundary offers retry and a link to Overview. |
| FR-DASH-01 | P0 | Overview summarizes profile status, sources, recent evidence, pending reviews, recent portfolio changes, and a next action. | All values derive from workspace state. The empty workspace shows guidance, not zeros dressed up as metrics. |

## 9. Non-functional requirements

| ID | Area | Requirement |
| --- | --- | --- |
| NFR-01 | Accessibility | Target WCAG 2.2 AA: keyboard operability, visible focus, semantic landmarks and headings, labeled controls, 4.5:1 text contrast, 3:1 non-text contrast, 24×24 px minimum target size, reduced-motion support. |
| NFR-02 | Responsive | Usable from 320 px to wide desktop with no horizontal page scroll. Primary actions remain reachable on narrow screens. |
| NFR-03 | Security & privacy | No secrets in client code or browser storage. Untrusted text is rendered as text, never as HTML. External URLs are restricted to `http`/`https`. No third-party scripts, fonts, or analytics. |
| NFR-04 | Performance | Routes render without blocking on network requests. Local state operations feel instant. Performance budgets are hypotheses to set after Phase D measurements. |
| NFR-05 | Reliability | Corrupt local data never crashes the app (FR-DATA-02). Every save reports success or failure truthfully. |
| NFR-06 | Maintainability | Business logic lives in framework-independent modules under `src/lib` and `src/features`. Small cohesive files. Documentation is kept in sync (see `rules.md` §7.7). |
| NFR-07 | Type safety | TypeScript `strict`. No `any` without a written justification. Persisted and imported data is validated at runtime with schemas. |
| NFR-08 | Testability | Pure state transitions and validation are unit-tested. Key components have component tests. Primary journeys have end-to-end coverage where browser automation is available. |
| NFR-09 | Clear failure behavior | Every failure has a user-visible message stating what failed and what to do next. Success messages appear only after success. |
| NFR-10 | Graceful degradation | The app is fully usable with no network access, no credentials, and all optional integrations unavailable. |

## 10. Data integrity and evidence requirements

1. **Every professional claim has an identifiable origin.** A claim originates from exactly one of:
   - **An external source:** a source item retrieved from a provider, for example a repository's description and topics.
   - **A user-supplied statement:** something the user typed as a fact, for example "Led the migration of the billing service" for confidential client work. It is labeled "User-supplied" and is not presented as externally verified.
   - **A manually edited description derived from source evidence:** wording the user changed, which still points to the original evidence.
2. **Layers stay distinct.** The data model and interface separate:
   - *Original source data:* the normalized snapshot of what the provider returned or the user entered as a source item.
   - *Extracted evidence:* specific facts or excerpts drawn from source data, with verification state.
   - *Generated wording:* template-produced or (future) AI-drafted sentences proposing how to describe the evidence.
   - *Reviewed content:* wording the user approved, possibly after editing.
   - *Published content:* content confirmed as published by a real publisher. There is none in the MVP.
3. **Conflicts are preserved.** When sources disagree, for example two different dates or a repository description that contradicts a user statement, Updater does not silently pick the more impressive version. Both evidence items are kept, the conflict is flagged, and the user resolves it.
4. **No invented statistics.** Updater never generates performance improvements, user counts, revenue, traffic, star counts, or percentage gains. A number may appear in a claim only if it appears in the evidence (for example, a repository star count captured with a timestamp) or the user typed it.
5. **Generated wording is not evidence.** A generated description can never support another claim.

## 11. MVP scope

The MVP includes:

- A working application shell with navigation for Overview, Sources, Review Queue, Portfolio, Resumes, and Settings.
- A bright/dark theme switcher. Bright mode is the default.
- An Overview dashboard derived entirely from workspace state.
- Developer profile editing, through onboarding and the portfolio editor.
- A Sources page with honest provider states: Manual entries (usable), Demo workspace (labeled), GitHub and blogs (Planned).
- Clearly labeled demo data, loaded only on explicit user choice.
- An evidence-oriented review queue with working edit, approve, dismiss, and restore actions.
- Portfolio editing and a local preview.
- Resume drafting, a print-friendly preview, and browser print.
- Settings with theme, privacy, integration summary, JSON export, and reset.
- Versioned, validated local persistence in browser storage.
- Documentation and developer setup instructions.

**Scope notes from Phase C** (the scope did not grow or shrink; these clarify how requirements were met):

- Journey A step 1: a first-time user lands on Overview, whose only recommended action is "Get started" (onboarding). No populated dashboard is shown. There is no automatic redirect.
- FR-SRC-05: removal is implemented for the demo workspace. Manual entries can't be "disconnected" because they aren't a connection.
- FR-EVID-02 / FR-PORT-04: achievements may exist without a project (for example articles), shown under "Other achievements".
- FR-RES-02: every portfolio project is selectable, because portfolio projects are either approved proposals or written by the user.
- FR-RES-05: suggestions use keyword overlap plus a small list of role hints (architecture.md §12).
- FR-SYNC-02/03: no provider synchronizes in the MVP, so every source states "Not synchronized" with the reason.

## 12. Future scope

These remain future work until genuinely implemented and verified:

- GitHub ingestion, starting with read-only public repositories, then OAuth for pull requests and private data.
- Automated and scheduled synchronization, with background jobs.
- Blog integrations: RSS/Atom feeds, DEV, Hashnode, Medium.
- Server-side durable storage and multi-device synchronization.
- User accounts beyond sign-in: server-held, per-account storage that follows the account across devices. (Optional Google sign-in with a separate workspace per account in the browser is implemented: T10.5, architecture.md §10.)
- AI-assisted summarization and drafting through a replaceable provider. It is optional and evidence-grounded.
- Automated resume generation beyond selection-based tailoring.
- Real public portfolio deployment, with status, URL, and rollback.
- Additional import/export formats (JSON Resume, generated PDF, Markdown).

## 13. Risks, dependencies, and assumptions

| Risk / dependency | Impact | Mitigation |
| --- | --- | --- |
| External API rate limits (for example GitHub's unauthenticated REST limit) | Sync stalls or partial data | Provider contract exposes rate-limit state. Sync is resumable. The UI shows when it can resume. |
| OAuth configuration | Integrations cannot be connected without registered apps and secrets | Integrations stay Planned until configured. The core app never depends on them. |
| Third-party outages | Sync failures | Failures are recorded per source and existing evidence remains usable. |
| Source-data inconsistencies | Conflicting or stale facts | Evidence keeps capture timestamps, and conflicts are flagged (§10.3). |
| AI hallucination (future) | Fabricated claims | AI output is a draft, grounded only in supplied evidence, never stored as evidence, and always reviewed (`rules.md` §7.6). |
| Data privacy | Exposure of personal or client details | Local-only MVP, no analytics, minimal fields, clear privacy text, user-controlled export and reset. |
| Credential exposure | Account compromise | Secrets are server-only env vars, never in browser storage or `NEXT_PUBLIC_*`, and never logged. |
| Browser storage limits and clearing | Data loss | JSON export, quota error reporting, documented limitation. |
| Deployment limitations | Local-only data does not follow the user across devices | Documented. Durable storage is future scope. |
| Cost and complexity of external services | Scope creep, paid dependencies | No paid service is required. New services need a decision-log entry in `memory.md`. |

Assumptions: users run a modern evergreen browser. Users accept local-only storage for the MVP. Demo fixtures use reserved `example.com` URLs so they cannot be mistaken for real accounts.

## 14. Success measures

These are **proposed product metrics (hypotheses)**. No analytics are collected in the MVP, so none of them is an observed value. They can be measured in moderated usability tests now, and through opt-in, privacy-preserving instrumentation if it is ever added.

| Metric | Definition | How to measure |
| --- | --- | --- |
| Time to first portfolio draft | From first open to a portfolio draft with a name, headline, and at least one approved project | Usability sessions |
| Evidence coverage | Share of claims in a portfolio with origin `source` or `edited_from_source` and at least one evidence link | Computable locally from workspace state |
| Review completion rate | Share of review items moved out of Needs review | Computable locally |
| Time to tailored resume | From "New resume" to printing | Usability sessions |
| Sync success rate | Successful sync attempts ÷ attempts per provider (once real providers exist) | Recorded sync results |
| Journey error rate | Errors encountered per primary journey attempt | End-to-end tests and usability sessions |

## 15. Acceptance criteria and release readiness

The MVP is usable when all of the following are verified. Each item maps to tasks in [`tracker.md`](./tracker.md).

| # | Criterion | Tracker tasks |
| --- | --- | --- |
| R1 | `npm install`, `npm run dev`, `npm run build`, `npm run lint`, `npm run typecheck`, and `npm test` succeed on a clean checkout without environment variables | T1.14, T9.4–T9.6 |
| R2 | Journeys A–E can be completed end to end in a browser | T3.8, T4.2, T5.1–T5.5, T6.1–T6.6, T7.1–T7.6, T9.9 |
| R3 | Bright mode is the default, dark mode works, and the preference persists without a flash | T2.3, T8.2 |
| R4 | No provider shows Connected without a real connection, and demo data is labeled everywhere | T4.2, T4.3 |
| R5 | Review transitions are unit-tested, and approval never changes publication state | T3.7, T5.6 |
| R6 | Evidence, generated wording, review state, and publishing state are separate in the data model and visible in the UI | T3.1, T3.6, T5.2, T6.4 |
| R7 | Persisted data is validated, corrupt data is recoverable, and no secrets are stored | T3.3, T9.3 |
| R8 | Accessibility review (keyboard, focus, contrast, labels) and responsive checks are done and findings are fixed or recorded | T9.7, T9.8 |
| R9 | README setup steps verified on a clean checkout | T9.10 |
| R10 | Documentation matches the implementation | T9.11 |
