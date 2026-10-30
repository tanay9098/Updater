# Updater — UI/UX Design Specification

| Field | Value |
| --- | --- |
| Version | 0.1.0 |
| Last updated | 2026-10-29 |
| Scope | The interface of the **Updater application** itself. The portfolio preview and resume preview are documents rendered *inside* Updater. This is not a spec for a separate personal website. |
| Implementation status | Phase B implemented §2–§5 and Settings → Appearance. Phase C implemented §6–§13. Where the implementation differs from the original text, the section has an *As implemented* note. See [`tracker.md`](./tracker.md). |
| Related | [`PRD.md`](./PRD.md) · [`architecture.md`](./architecture.md) · [`rules.md`](./rules.md) |

## 1. Design philosophy

Updater should feel like a carefully made developer tool: calm, precise, trustworthy, efficient. Every element answers one of these questions: what is this, where did it come from, what state is it in, and what can I do next?

**Avoid:**

- generic AI-SaaS layouts
- gradients and decorative glassmorphism
- hero sections inside the app
- deeply rounded nested cards
- charts without a decision they support
- arbitrary statistics
- motion for its own sake
- decoration that competes with content
- any fake activity or integration success

**Prefer:**

- clear typography and deliberate spacing
- restrained neutral color with one accent
- 1px borders over shadows
- strong hierarchy and functional density
- explicit labels instead of icon-only meaning
- consistent interactions
- empty states that teach the next step
- visible provenance on every claim
- explicit user control over every state change

Concrete rules:

- **Radius:** controls and small elements use 6 px (`--radius-sm`), panels use 8 px (`--radius-md`). Nested containers never add another rounded border. Use dividers instead.
- **Elevation:** surfaces are separated by borders. Shadows appear only on floating layers (menus, dialogs, toasts).
- **Color:** neutral surfaces plus one blue accent for primary actions and links. Status colors appear only in status indicators and messages.
- **Icons:** Lucide icons at 16 px (inline) or 20 px (navigation and top-bar buttons), stroke 1.75. Status badges use 14 px to match their 12 px text. Every icon either sits beside a text label or has an accessible name.

## 2. Theme system

Two complete themes, applied through `data-theme="light" | "dark"` on `<html>`.

- **Bright (light) mode is the default** for every first visit, regardless of the operating-system preference (D-008).
- **Switcher:** a button in the top bar and a radio group in Settings → Appearance. Both read the same state, so they always agree.
  - *Implemented deviation (D-013):* the top-bar button has a **constant** accessible name, "Dark theme", plus `aria-pressed` (true in dark mode). The original spec changed the label *and* used `aria-pressed`, which makes screen readers announce contradictory states ("Switch to light theme, pressed"). The WAI-ARIA button pattern says a toggle's name must not change when its state does. A tooltip names the action ("Switch to light theme" / "Switch to dark theme"). The icon shows the current theme (sun or moon). CSS selects it from `data-theme`, so it is correct before hydration.
- **Persistence:** stored in `localStorage` under `updater:theme`. If saving fails (storage blocked or full), the theme still changes for the current visit, and a warning toast says so: "Theme changed for this visit only". The preference also follows changes made in other open tabs.
- **No flash:** a small static inline script in the root layout reads the stored preference and sets `data-theme` before first paint. `<html>` uses `suppressHydrationWarning`. If storage is unavailable the theme falls back to light without errors.
- **Tokens:** all colors are semantic CSS custom properties defined in `src/app/globals.css` and mapped into Tailwind with `@theme inline`. Components use token utilities (`bg-surface`, `text-muted`, `border-border`…), never raw hex values.

### 2.1 Color tokens

Ratios in parentheses were computed with the WCAG 2.x relative-luminance formula against `--surface` (light `#ffffff`, dark `#141417`) unless noted. Status colors were checked against their own `*-surface` fills: all are ≥ 4.7:1 in light and ≥ 6.3:1 in dark. Rendered contrast is re-verified during the accessibility review (T9.7).

| Token | Purpose | Light | Dark |
| --- | --- | --- | --- |
| `--background` | Page background | `#f7f7f8` | `#0c0c0e` |
| `--surface` | Panels, list rows, inputs | `#ffffff` | `#141417` |
| `--surface-elevated` | Menus, dialogs, popovers | `#ffffff` (+ shadow) | `#1c1c21` (+ shadow) |
| `--surface-muted` | Subtle fills: table headers, hover, code | `#f1f1f3` | `#1b1b1f` |
| `--foreground` | Primary text | `#18181b` (17.7:1) | `#f4f4f5` (16.7:1) |
| `--foreground-secondary` | Secondary text | `#3f3f46` (10.4:1) | `#d4d4d8` (12.4:1) |
| `--muted` | Metadata, help text | `#5c5c66` (6.6:1; 5.9:1 on `--surface-muted`) | `#a1a1aa` (7.2:1) |
| `--border` | Dividers, panel borders (decorative) | `#e4e4e7` | `#27272c` |
| `--border-strong` | Input borders, control outlines (≥3:1) | `#8a8a94` (3.4:1) | `#6b6b76` (3.5:1) |
| `--control` | Secondary button and control fill | `#ffffff` | `#1c1c21` |
| `--control-hover` | Control hover fill | `#f4f4f5` | `#26262c` |
| `--primary` | Primary button fill, selected nav marker | `#1d4ed8` | `#3b82f6` |
| `--primary-foreground` | Text on primary | `#ffffff` (6.7:1) | `#0c0c0e` (5.3:1) |
| `--link` | Inline links | `#1d4ed8` | `#7aa7ff` |
| `--focus-ring` | Focus outline (2 px + 2 px offset) | `#2563eb` | `#7aa7ff` |
| `--success` / `--success-surface` | Approved, saved, local-connected | `#15803d` / `#f0fdf4` | `#4ade80` / `#0f2417` |
| `--warning` / `--warning-surface` | Needs review, needs attention, conflicts | `#a35200` / `#fff7ed` | `#fbbf24` / `#2a1f0a` |
| `--error` / `--error-surface` | Failures, destructive actions | `#b91c1c` / `#fef2f2` | `#f87171` / `#2a1214` |
| `--info` / `--info-surface` | Informational, edited, syncing | `#1d4ed8` / `#eff6ff` | `#7aa7ff` / `#0f1a33` |
| `--demo` / `--demo-surface` | Demo data label | `#6d28d9` / `#f5f3ff` | `#c4b5fd` / `#1f1833` |
| `--disabled` / `--disabled-surface` | Disabled text and fill | `#a1a1aa` / `#f4f4f5` | `#5c5c66` / `#1b1b1f` |

**Tokens added during Phase B** (needed for interaction states the table above did not cover; ratios computed with the same formula):

| Token | Purpose | Light | Dark |
| --- | --- | --- | --- |
| `--primary-hover` | Primary button hover | `#1e40af` (`--primary-foreground` on it 8.7:1) | `#60a5fa` (7.7:1) |
| `--error-foreground` | Text on destructive buttons | `#ffffff` (6.5:1 on `--error`) | `#0c0c0e` (7.1:1) |
| `--error-hover` | Destructive button hover | `#991b1b` (8.3:1) | `#fca5a5` (10.3:1) |
| `--overlay` | Dialog and drawer backdrop | `rgb(24 24 27 / 0.4)` | `rgb(0 0 0 / 0.6)` |
| `--elevation` | Shadow for floating layers (Tailwind `shadow-elevated`) | soft two-layer shadow | dark shadow plus a faint 1 px edge |

**Enforcement:** `globals.css` resets Tailwind's default color palette, font sizes, and font weights (`--color-*: initial` and so on). Only the semantic utilities exist (`bg-surface`, `text-muted`, `border-border-strong`, `text-title`, `font-semibold`…), so a raw palette class such as `bg-zinc-100` does not compile to anything. The `dark:` variant targets `[data-theme="dark"]`, never the OS preference. It is used only for theme-dependent visibility (the toggle icon), not for colors.

**Contrast expectations:**

- Body and secondary text: ≥ 4.5:1.
- Large text (≥ 18.66 px bold or 24 px): ≥ 3:1.
- Input borders, focus rings, and icons that carry meaning: ≥ 3:1 against adjacent colors.
- Status text is always paired with a label and an icon, never color alone.
- Disabled controls are exempt from contrast, but always carry an explanation (tooltip or helper text) when the reason is not obvious.

## 3. Typography

Font stacks (D-002):

- **Sans:** `ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`
- **Mono:** `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace`

| Role | Size / line height | Weight | Notes |
| --- | --- | --- | --- |
| Page title (`h1`) | 1.5rem / 2rem | 600 | One per page. Tracking −0.01em. |
| Section heading (`h2`) | 1.125rem / 1.75rem | 600 | |
| Subsection (`h3`) | 1rem / 1.5rem | 600 | |
| Body | 0.875rem / 1.375rem (14/22 px) | 400 | Default in app UI |
| Long-form body | 1rem / 1.75rem | 400 | Portfolio and resume previews, onboarding copy |
| Label | 0.875rem / 1.25rem | 500 | Form labels, column headers |
| Supporting text | 0.8125rem / 1.25rem | 400 | `--foreground-secondary` or `--muted` |
| Metadata / timestamps | 0.75rem / 1rem | 500 | `--muted` (≥ 5.9:1). Never lighter. Dates use `<time dateTime>`. |
| Code / identifiers | 0.8125rem mono | 400 | Repository names, IDs, URLs in metadata. `--surface-muted` background inline. |

Headings never exceed 1.5rem in the app. Font weights are limited to 400, 500, and 600.

Tailwind utilities for these roles: `text-title`, `text-heading`, `text-subheading`, `text-body` (default on `body`), `text-long`, `text-label`, `text-support`, `text-meta`, and `text-code`. Weights: `font-normal`, `font-medium`, `font-semibold`.

## 4. Layout and responsive behavior

**Breakpoints:** Tailwind defaults (`sm` 640, `md` 768, `lg` 1024, `xl` 1280).

- **Application shell:**
  - ≥ `lg`: fixed left sidebar (15rem) holding the product name, the primary navigation, and a footer showing the save status and "Data stored in this browser".
    - *As implemented (Phase C):* the footer shows the real save status: "Loading workspace…", "Data stored in this browser" (nothing saved this visit yet), "Saved locally · 14:02", or "Not saved: {reason}" with a "Retry save" button. The drawer shows the same status.
  - < `lg`: the sidebar is replaced by a top bar with a menu button that opens the navigation in a modal drawer (Radix Dialog, focus-trapped, closes on Escape and on navigation).
- **Top bar:** contains the page title area (breadcrumb on nested pages), a demo-data indicator when demo data is loaded, the theme toggle, and on narrow screens the menu button.
  - *As implemented:* the indicator reads "Includes demo data" ("Demo data" below `sm`) and links to Settings → Data. It stays while any demo-derived record exists, including approved demo content kept after the demo source was removed, so it never says "loaded" when nothing is loaded. There is no breadcrumb; nested pages show the section name. Height 3.5rem, bottom border. Sticky. `scroll-padding-top` keeps focused elements clear of it.
  - As implemented: at ≥ `lg` the title area shows the current section name as plain text (not a heading; each page owns its `h1`). Below `lg` it shows the menu button and product mark.
  - *Account button (T10.5):* when signed in, a round 2.25rem button with the account's initials sits after the theme toggle. Its accessible name is "Account: {name or email}". The menu shows the name and email, "Account settings" (Settings → Account), and "Sign out" ("Signing out…" while pending). Nothing is shown until the signed-in account is known. No Google avatar is loaded, so the app makes no third-party image request.
- **Sign-in page (`/sign-in`, T10.5):** outside the app shell. Product mark above one bordered card (max-width 28rem), centered on wide screens and top-aligned on narrow ones. Signed out: `h1` "Sign in to Updater", the line "New here? Continuing with Google creates your Updater account the first time." (there is no separate sign-up), one full-width primary button "Continue with Google" (busy while the redirect starts), and three facts: what Google shares and what Updater keeps, that the portfolio and resumes belong to the account, and that the workspace is still stored in the browser. An Auth.js error shows an error alert "Sign-in didn't complete" with a fixed message. Sign-in is compulsory (D-031): when the server isn't configured, the page shows "Sign-in isn't available" (missing variable names only in development), and every other page redirects here.
- **Signed out inside the app:** if the account signs out in another tab, the page's workspace area is replaced by "You're signed out" with a "Sign in" button; the sidebar save status reads "No workspace open". If the account can't be checked, an error alert "Your sign-in couldn't be checked" with "Try again".
- **Main content:** `max-width: 72rem`, horizontal padding 1rem (< `sm`), 1.5rem (`sm`–`lg`), 2rem (≥ `lg`), vertical padding 1.5rem. Page header (title, one-line description, primary action) sits above the content and is separated by 1.5rem.
- **Spacing scale:** multiples of 4 px. 8, 12, 16, 24, and 32 px are the usual steps. Related fields are 16 px apart and sections 32 px apart.
- **Lists and tables:** prefer bordered lists with dividers. Tables are used only for genuinely tabular data (for example the source item list). Below `md`, tables collapse into stacked rows with labels. No horizontal page scroll. A table may scroll horizontally inside its own container as a last resort, with a visible affordance.
- **Dialogs:** centered, max-width 32rem (forms) or 28rem (confirmations), full-width sheet below `sm`. Menus anchor to their trigger.
- **Forms:** single column, max-width 40rem. Labels above inputs. Buttons right-aligned on desktop, full-width stacked on mobile with the primary action first.
- **Editor + preview (Portfolio, Resume):**
  - ≥ `xl`: two columns (editor 55% | preview 45%), with the preview sticky.
  - < `xl`: tabs "Edit" and "Preview" above the content, keeping the save status and primary action visible.

## 5. Component system

Built on Radix UI primitives where behavior is non-trivial (D-005), styled with tokens. All interactive targets are ≥ 24×24 px. Primary touch targets on mobile are ≥ 40 px tall.

| Component | Pattern |
| --- | --- |
| Button | Variants: `primary` (filled `--primary`), `secondary` (bordered `--control`), `ghost` (no border; toolbars), `destructive` (filled `--error`, only in confirmations), `link`. Sizes `sm` (32 px) and `md` (36 px). A loading state shows a spinner, keeps the label, and sets `aria-busy`. Disabled buttons explain why nearby. |
| Text input / Textarea | 36 px height. `--border-strong` border, focus ring. Label always visible. Helper text below. Error text below in `--error` with an icon, linked by `aria-describedby`, and `aria-invalid`. Character counters for limited fields. |
| Select | Native `<select>`, styled. Accessible by default. |
| Checkbox / Switch | Radix Checkbox for selections (resume builder). Radix Switch only for immediate on/off settings (project visibility). |
| Tabs | Radix Tabs (Edit/Preview, review status filters). Arrow-key navigation. |
| Menu | Radix DropdownMenu for secondary row actions ("More actions for {item}"). |
| Dialog | Radix Dialog with a title and description, focus trap, Escape to close, focus returned to the trigger. |
| Confirmation | Radix AlertDialog. The title names the action ("Reset workspace?"), the body states exactly what is lost, the cancel button is focused first, and the destructive button is labeled with the action ("Reset workspace"), never "OK". |
| Tooltip | Radix Tooltip for supplemental info only, never the sole source of required information. Also opens on keyboard focus. |
| Status indicator | Badge = icon + text label + tone (success/warning/error/info/neutral/demo). Used for source, review, verification, origin, and publication states (§9, §10). |
| Activity list | Rows: icon, one-line summary, relative time with absolute time on hover/title, and an optional link. |
| Empty state | Inside the region it replaces: a short heading ("No items need review"), one sentence of guidance, and at most one primary action. No illustrations. |
| Notifications | Toasts (Radix Toast) for completed actions, with polite live-region announcements. Errors that need action appear as inline alerts (`role="alert"`) near the cause, not only as toasts. A success toast appears only after the store confirms the save. |
| Loading skeleton | Neutral blocks matching the layout (`--border` fill: `--surface-muted` was nearly invisible on dark surfaces). Wrapped in a `role="status"` region that announces "Loading…" once. Shown while the workspace hydrates. With reduced motion the animation is off. |
| Panel | Bordered section with an `h2` header row and a divider (`components/ui/panel.tsx`). Content inside uses dividers, never nested rounded containers. |
| Save status | Sidebar footer and editor headers: "Saving…", "Saved locally · 14:02", or "Not saved: storage unavailable" with a retry action. |

## 6. Information architecture

| Navigation label | Route | Purpose |
| --- | --- | --- |
| Overview | `/` | Current state and next action |
| Sources | `/sources` | Providers, their honest states, source items, and manual entry |
| Review Queue | `/review` | Proposals awaiting decisions |
| Portfolio | `/portfolio` | Edit and preview portfolio draft |
| Resumes | `/resumes`, `/resumes/[resumeId]` | List of drafts, and the builder |
| Settings | `/settings` | Profile basics, appearance, integrations, privacy, data |
| (no nav item) | `/onboarding` | First-run flow. Reachable again from Settings. |

The Review Queue nav item shows a count badge of `needs_review` + `edited` items when it is non-zero (for example "Review Queue, 3 pending"). *As implemented:* the visible number is `aria-hidden` and the link's accessible name is "Review Queue, 3 pending". These labels and routes are used consistently in code, docs, and UI.

## 7. Onboarding

Shown at `/onboarding` when the workspace has no profile and onboarding is not completed. Overview links to it while incomplete. The step indicator shows "Step n of 3". Every step after the first can be skipped.

1. **Welcome.** Three short statements:
   - "Updater collects evidence of your work."
   - "It proposes updates you review."
   - "Nothing is published without your action."

   Plus a privacy note: "In this version, everything is stored only in this browser." Primary action: "Get started".
2. **Your profile.** Name (required), headline (optional). Inline validation. "Continue" saves the profile. More fields live in the Portfolio editor.
3. **Add evidence.** Three choices as radio cards:
   - **Add your own entries.** Goes to Sources → manual entry form.
   - **Explore with demo data.** States: "Loads fictional sample data, labeled Demo everywhere. You can remove it in Settings."
   - **Skip for now.**

   Under them, a "Planned integrations" note lists GitHub and blog feeds as not yet available, with the permissions they will request.

Completion leads to Overview. Setup progress ("Profile added") is never shown as integration status ("Connected").

*As implemented:* Overview's next-action panel links to onboarding while it is incomplete; there is no automatic redirect. Step 2 uses the same profile form as the editor ("Save profile", then "Skip for now" / "Continue without changes"). "Finish setup" goes to Sources (own entries), the Review Queue (demo data, loaded in the same save), or Overview (skip). Settings → "Restart onboarding" clears only the onboarding flag.

## 8. Overview dashboard

The page header reads "Overview" with the description "Where your portfolio stands and what to do next." Below it, in order of hierarchy:

1. **Next action panel.** One recommendation chosen by rules, in priority order:
   1. complete the profile
   2. add evidence
   3. review N pending items
   4. preview the portfolio
   5. create a resume

   It has a single primary button.
2. **Portfolio status.** Profile checklist (name, headline, introduction, at least one link, at least one visible project), counts of approved claims and visible projects, and publication state: "Not published. Publishing isn't available in this version".
3. **Sources.** Compact list of providers with status badges and item counts.
4. **Pending review.** Up to 5 items with title, source, and badge. "Open Review Queue" link.
5. **Recent evidence.** Up to 5 most recently discovered evidence items, with date and source.
6. **Recent portfolio changes.** Up to 5 `ActivityEntry` rows. Only actions the user actually took in Updater.

States:

- **Loading:** skeletons per section.
- **Empty workspace:** the next-action panel recommends onboarding, and the other sections show their empty states. No zero-value "metrics".
- **Demo:** a "Demo data loaded" banner with a "Remove demo data" link.
- **Storage error:** an alert at the top.

All numbers are counts of real workspace records. There are no charts in the MVP.

## 9. Sources page

The header reads "Sources", with the description "Where Updater gets evidence of your work." A banner appears when demo data is loaded.

Provider list (one panel per provider, divided rows, not nested cards). Each row has:

- **Name, kind, and status badge.**
- **What it provides:** one sentence plus a capabilities list.
- **Permissions:** "Reads: …" and "Never: …".
- **Next step:** the action button, or setup notes for Planned providers.
- **Sync line:** "Last synchronized {time}: {outcome}", or "Not synchronized: entries are added manually".
- **Items:** an expandable list of source items with title, kind, date, URL (external-link icon, opens in a new tab), demo label, and evidence count.

| Status (internal) | Badge label | Tone | Used by in MVP |
| --- | --- | --- | --- |
| `connected` | "Connected" (external) / "Local" (Manual entries) | success | Manual entries → **Local** |
| `not_connected` | Not connected | neutral | none |
| `needs_attention` | Needs attention | warning | none |
| `syncing` | Syncing | info | none |
| `unavailable` | Unavailable | neutral | none |
| `planned` | Planned | neutral (dashed border) | GitHub, Blog feeds (RSS/Atom) |
| `demo` | Demo data | demo | Demo workspace |

- **Manual entries** has an "Add entry" button opening a dialog with: kind (project, article, contribution, achievement), title, URL (optional), date (optional), and description, which becomes your statement. Help text: "This is recorded as a user-supplied statement, not externally verified."
- **Demo workspace** has a "Load demo data" button (or "Remove demo data", with confirmation).
- **Planned** providers have no connect button. They show "Not available yet" and the future flow, for example: "You'll sign in with GitHub and grant read-only access to public repositories."

*As implemented:* the demo provider reads **"Not loaded"** (neutral) until loaded, never "Not connected". The kind line reads "Stored in this browser", "Fixture data", "Code host", or "Publishing". Each source item row also lists its evidence statements with verification badges and the status of its proposals, so dismissed items' evidence stays visible here. The manual entry dialog adds "Technologies" for projects and an optional "Portfolio project" for other kinds. The banner reads "Your workspace includes demo data".

## 10. Evidence and review queue

The header reads "Review Queue", with the description "Proposed updates. Nothing reaches your portfolio until you approve it." Tabs: Needs review (default), Edited, Approved, Dismissed, each with a count.

Each review item is a bordered row that expands to a detail view:

- **Collapsed:**
  - kind label (New project / New achievement / New skill)
  - proposed text (2-line clamp)
  - source name and type
  - discovered date
  - review status badge
  - verification badge
  - demo badge if applicable
  - quick actions: Approve, Edit, and Dismiss (in a menu on mobile)
- **Expanded:**
  - **Proposal** shows the current text, the wording origin ("Template wording from source fields", "Your wording", and in future "AI draft"), and for edited items a "Show original proposal" toggle.
  - **Evidence** lists each statement with its verification badge, structured facts (`key: value`, mono), captured date, and conflict warning.
  - **Source** shows the item title, kind, occurred date, and a link "Open source" (new tab) when a valid URL exists. Demo items say "Demo link (example.com)".
  - **Why suggested** gives one sentence, for example "Created from the repository's name, description, and topics."

| Review status | Badge | Tone |
| --- | --- | --- |
| `needs_review` | Needs review | warning |
| `edited` | Edited | info |
| `approved` | Approved | success |
| `dismissed` | Dismissed | neutral |
| (derived) published | Published | success, with a globe icon. Only when a real publisher confirmed it, so never in the MVP. |

| Verification | Badge |
| --- | --- |
| `source_reported` | From source |
| `user_asserted` | User-supplied |
| `unverified` | Unverified |
| `conflicting` | Conflict (warning) |

Interactions:

- **Edit** turns the proposal into a textarea with Save and Cancel. Save sets Edited and the toast reads "Edit saved". Approving later uses the edited text.
- **Approve** applies immediately, no confirmation (it is reversible from the portfolio). The toast reads "Approved and added to your portfolio draft. Not published." and includes a "View in portfolio" link. Items with conflicting evidence first open a dialog that shows the conflict and requires a checkbox ("I've checked this conflict") to approve.
- **Dismiss** opens a small dialog with an optional reason. The toast reads "Dismissed. Evidence kept. Restore from the Dismissed tab."
- **Restore** (Dismissed tab) moves the item back to Needs review.
- **Revert edit** (Edited items) goes back to the original proposal after confirmation.
- Focus moves to the next item after an action removes the current one from the list.

*As implemented:*

- Quick actions are always visible buttons that wrap on narrow screens instead of moving into a menu: three labeled buttons fit at 320 px, and a menu would hide them.
- Editing a skill proposal uses a single-line "Skill name" field limited to 40 characters.
- Restoring a dismissed item returns it with its original wording (any earlier edit is cleared).
- Tab labels read "Needs review, 3"; the visible count is `aria-hidden`.
- When an action can't be saved, the toast says "Changes could not be saved" and no success message appears.

## 11. Portfolio editor

The header reads "Portfolio", with a draft state line: "Draft · Saved locally {time} · Not published". The Publish button is disabled, with helper text: "Publishing isn't available in this version. Use the preview to check your portfolio."

Editor sections (each an `h2` with a form):

1. **Profile:** name, headline, introduction (character counter), location.
2. **Links:** a list of label + URL rows, with add, remove, and reorder (up/down buttons). URL validated (`http`/`https`) with an inline error.
3. **Skills:** chips with an origin indicator (dot plus tooltip "From source" / "User-supplied"). Add by typing, remove with a button per chip ("Remove TypeScript").
4. **Projects:** ordered list. Each project has name, summary, technologies, links, visibility switch ("Shown in portfolio"), move up/down, and delete (with confirmation).
5. **Achievements (claims):** listed under their project. Each has an origin badge (Source / User-supplied / Edited from source), an evidence button ("Evidence (2)") that opens a popover listing evidence and source links, inline edit, and remove. Editing a Source claim shows "Will be marked Edited from source. Evidence links are kept."

Behavior:

- Edits save on blur or explicit Save per section, and the save status always reflects the real outcome.
  - *As implemented (D-026):* explicit Save per section only. Each form shows "Unsaved changes" while it differs from the saved draft, its Save button is disabled when nothing changed, and the browser asks for confirmation before a reload or tab close loses unsaved edits. Skills, visibility, ordering, and deletions save immediately.
- Validation errors appear beside the field, and the form keeps the user's input.
- The preview header reads "Local preview: not published. Only you can see this." The preview renders name, headline, intro, links, skills, and visible projects with claims. Demo-derived content shows a Demo label even in the preview.
  - *As implemented:* the preview shows the saved draft only ("It shows your saved draft, not unsaved edits"). Approved claims without a project appear in a sixth editor section, **Other achievements**, and in the preview (D-022). A project's summary from an approved proposal is its summary claim: it shows an origin badge and evidence, and editing it marks it Edited from source (D-023). Achievements can also be added by hand; they are labeled User-supplied.

## 12. Resume builder

- **`/resumes`:** a list of drafts showing name, target role, updated time, and actions (Open, Duplicate, Delete with confirmation). "New resume" opens a dialog asking for target role (required) and name (defaults to the role).
- **`/resumes/[resumeId]`:** editor plus preview (§4).
  - **Target role:** an editable text field. A "Suggest selections" button pre-selects approved items matching the role and announces "Selected 4 projects and 9 skills based on 'Backend Engineer'. Review the selections below." It never adds text.
  - **Summary:** a textarea, empty by default, with an "Insert portfolio introduction" helper that copies the user's own intro. No generated text.
  - **Projects:** checkboxes over projects with at least one approved claim, with reordering.
  - **Achievements:** checkboxes per approved claim, grouped by project, with origin badges and an optional per-resume wording override ("Wording for this resume only").
  - **Skills:** checkboxes.
  - **Contact:** a toggle to include the email and links.
  - **Unapproved items** are not listed. A note says "{n} items are still in the Review Queue."
- **Preview:** a single-column document, A4/Letter proportion, real text, and a semantic heading order.
- **Actions:** Save (with save status) and "Print / Save as PDF" (`window.print()`). No ATS-compatibility claims.
- **Print stylesheet:** hides app chrome, uses black text on white regardless of theme, sets page margins to 16 mm, and avoids breaks inside entries.

*As implemented:*

- Every portfolio project is selectable, not only projects with an approved claim: projects are either approved proposals or written by the user, so both count as approved content. Hidden projects are marked "(hidden in portfolio)".
- Edits stay in the page until "Save draft"; the header shows "Unsaved changes", and the preview shows the current edits ("Shows your current edits, including unsaved changes"). Print uses the same view through a print-only copy, so it works from either tab.
- "Suggest selections" has an optional "Keywords" field, replaces the current selections in the unsaved draft, and announces the result in a status line ("… Not saved yet."). It never changes text.
- Selected projects get an "Order in this resume" list with up/down buttons, and a per-resume summary override when the summary is a claim.
- A warning appears when the profile has no name; the resume never prints placeholder text.
- A note under the actions says the browser prints the PDF and that no compatibility with applicant tracking systems is checked.

## 13. Settings

Sections:

- **Account** (`#account`, first section, T10.5): signed in, "Signed in with Google" with the name and email, a note that the portfolio and resumes belong to this account, and "Sign out". If this browser holds a workspace from before sign-in became compulsory, a row "Workspace saved before sign-in" lists its contents with "Move into this account…", which confirms (Cancel focused, counts of what is replaced) and then removes the unowned copy.
- **Profile basics:** links to the Portfolio editor for full editing, plus name and headline inline.
- **Appearance:** theme radio group (Light (default), Dark).
- **Integrations:** a read-only status summary linking to Sources.
- **Privacy:** an accurate description of data handling. Data stays in this browser's local storage. Nothing is sent to Updater servers. There are no analytics. Clearing site data deletes the workspace. Demo data is fictional. *With compulsory sign-in (D-031),* the text says the workspace is stored under the account, what the sign-in cookie holds, that other accounts on the browser can't open it in Updater but developer tools can read it, that sign-out keeps it, and that it doesn't follow the account to other devices.
- **Data:**
  - "Export workspace (JSON)".
  - "Import workspace", which validates the file, shows errors, and replaces only after confirmation.
  - "Remove demo data", with confirmation and a choice to keep approved claims.
  - "Reset workspace", with a confirmation that lists everything that will be deleted and suggests exporting first.
  - "Restart onboarding".

*As implemented:* the integration summary uses the same status function as Sources and adds each provider's sync note. The import confirmation states the counts that will be replaced and the counts in the file; a failed import shows up to 10 field errors and changes nothing. Reset lists the counts it deletes. The theme preference is not part of the workspace and survives reset and import.

## 14. Interaction and motion

- Transitions are 120–160 ms ease-out on color, opacity, and transform. They are used only for menus, dialogs, toasts, and expanding rows.
- `prefers-reduced-motion: reduce` disables transforms and skeleton shimmer, and shortens fades to 0 ms.
- Pending actions show inline progress (button spinner, "Saving…"). Failures show an inline error with a retry action. Success is announced only after the store reports success.

## 15. Accessibility

Target **WCAG 2.2 AA**.

- **Structure:**
  - Landmarks: `header`, `nav` (labeled "Primary"), and `main`.
  - A skip link "Skip to content".
  - One `h1` per page and an ordered heading hierarchy.
  - Route changes move focus to the page `h1`. `PageHeader` does this. The initial load never moves focus. With Cache Components, previous pages stay mounted but hidden (React `<Activity>`), and their effects re-run when shown again, so back and forward navigation also focus the visible heading (architecture.md §4.1).
- **Keyboard:**
  - Every action is reachable by Tab and Shift+Tab.
  - Menus, tabs, and dialogs follow WAI-ARIA patterns (via Radix).
  - Escape closes overlays.
  - No keyboard traps.
- **Focus:**
  - Always visible: a 2 px `--focus-ring` outline with a 2 px offset, using `:focus-visible`.
  - Never removed without a replacement.
  - Focus is not obscured by sticky headers (WCAG 2.4.11).
- **Names:** icon buttons have `aria-label`s that include the item ("Approve 'Built trail-notes…'"). Links that open new tabs say so (visually hidden "opens in new tab").
- **Forms:** visible labels, required fields marked with text "(required)", and errors linked via `aria-describedby` with `aria-invalid`. Errors are summarized when a multi-field form fails to submit.
- **Status messages:** a polite live region for toasts and save status, and `role="alert"` for blocking errors.
- **Contrast and color:** tokens meet §2.1. State is never conveyed by color alone.
- **Targets:** ≥ 24×24 px (WCAG 2.5.8), ≥ 40 px for primary mobile actions.
- **Motion:** respects reduced motion (§14).
- **Dragging:** reordering uses buttons, not drag-only (WCAG 2.5.7).

## 16. Privacy and trust in the interface

Every claim surface makes these visible:

| Question | UI answer |
| --- | --- |
| What is imported? | Sources page item lists and the provider "Reads:" permissions |
| Where did a claim originate? | Origin badge plus evidence popover with source links |
| Did AI draft the wording? | Wording label ("Template wording", "Your wording"; "AI draft" reserved for future). The MVP never uses AI. |
| Has the user reviewed it? | Review status badge. Only approved content appears in the portfolio and resumes. |
| Saved, approved, or published? | Draft line ("Saved locally"), Approved badge, and publication state ("Not published") are shown separately |
| What happens on disconnect or removal? | The confirmation dialog states which items, evidence, and claims are removed or kept |

Demo data shows a violet "Demo data" badge on every item, plus a global top-bar indicator while any demo data exists.

## 17. Definition of done (UI)

A screen is done when all of the following hold:

1. It matches this spec, or the deviation is recorded here.
2. It works in light and dark themes, with no hard-coded colors.
3. Loading, empty, error, and success states are implemented.
4. It works by keyboard only, with visible focus.
5. All controls have accessible names, and forms show linked errors.
6. It has no horizontal page scroll at 320 px, 768 px, or 1280 px widths.
7. Demo data is labeled, and no integration or publication state is overstated.
8. Text contrast is at least 4.5:1 (spot-checked with tooling during T9.7).
9. Reduced motion is respected.
10. Component tests cover its key interactions, where practical.
