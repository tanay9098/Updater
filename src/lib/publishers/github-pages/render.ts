import { safeExternalUrl } from "@/lib/validation/url";
import type { PublicPortfolio } from "@/lib/validation/publication";

/**
 * Renders the public copy into a static site for GitHub Pages (T10.9,
 * design.md §11.1). Plain HTML and one stylesheet: no scripts, no external
 * requests, no build step in the developer's repository.
 *
 * The structure follows the local preview (`portfolio-preview.tsx`): name,
 * headline, location, introduction, links, skills, projects, other
 * achievements. Every piece of text is escaped and every link passes
 * `safeExternalUrl` again (rules.md §7.3.6–7), so nothing in a portfolio
 * can add markup or script to the page.
 */

export type SiteFile = { path: string; content: string };

/** Marks a `gh-pages` branch as written by Updater, so a later publish may replace it without asking. */
export const MARKER_FILE = ".updater-site";
export const SITE_FILES = ["index.html", "404.html", "site.css", "portfolio.json", ".nojekyll", MARKER_FILE] as const;

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ESCAPES[character]);
}

function link(label: string, url: string): string {
  const safe = safeExternalUrl(url);
  if (!safe) return escapeHtml(label);
  return `<a href="${escapeHtml(safe)}" rel="noopener noreferrer">${escapeHtml(label)}</a>`;
}

function linkList(links: ReadonlyArray<{ label: string; url: string }>, className: string): string {
  if (links.length === 0) return "";
  return `<ul class="${className}">${links.map((item) => `<li>${link(item.label, item.url)}</li>`).join("")}</ul>`;
}

/** Keeps the developer's line breaks without inserting markup: each paragraph is escaped text. */
function paragraphs(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => `<p>${escapeHtml(part).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function page(title: string, description: string, body: string): string {
  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    // No scripts, frames, forms, or third-party requests: only this site's stylesheet.
    `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'">`,
    '<meta name="referrer" content="strict-origin-when-cross-origin">',
    '<meta name="generator" content="Updater">',
    `<title>${escapeHtml(title)}</title>`,
    description ? `<meta name="description" content="${escapeHtml(description)}">` : "",
    '<link rel="stylesheet" href="site.css">',
    "</head>",
    "<body>",
    body,
    "</body>",
    "</html>",
    "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function renderIndex(portfolio: PublicPortfolio): string {
  const { profile } = portfolio;
  const header = [
    `<h1>${escapeHtml(profile.name)}</h1>`,
    profile.headline ? `<p class="headline">${escapeHtml(profile.headline)}</p>` : "",
    profile.location ? `<p class="meta">${escapeHtml(profile.location)}</p>` : "",
    profile.intro ? `<div class="intro">${paragraphs(profile.intro)}</div>` : "",
    linkList(profile.links, "links"),
  ].join("");

  const sections: string[] = [];
  if (portfolio.skills.length > 0) {
    sections.push(
      `<section aria-labelledby="skills"><h2 id="skills">Skills</h2><ul class="chips">${portfolio.skills
        .map((skill) => `<li>${escapeHtml(skill)}</li>`)
        .join("")}</ul></section>`,
    );
  }
  if (portfolio.projects.length > 0) {
    const projects = portfolio.projects
      .map((project) =>
        [
          "<article>",
          `<h3>${escapeHtml(project.name)}</h3>`,
          project.summary ? `<p>${escapeHtml(project.summary)}</p>` : "",
          project.technologies.length > 0 ? `<p class="meta">${escapeHtml(project.technologies.join(" · "))}</p>` : "",
          project.achievements.length > 0
            ? `<ul class="bullets">${project.achievements.map((text) => `<li>${escapeHtml(text)}</li>`).join("")}</ul>`
            : "",
          linkList(project.links, "links"),
          "</article>",
        ].join(""),
      )
      .join("");
    sections.push(`<section aria-labelledby="projects"><h2 id="projects">Projects</h2>${projects}</section>`);
  }
  if (portfolio.achievements.length > 0) {
    sections.push(
      `<section aria-labelledby="achievements"><h2 id="achievements">Other achievements</h2><ul class="bullets">${portfolio.achievements
        .map((text) => `<li>${escapeHtml(text)}</li>`)
        .join("")}</ul></section>`,
    );
  }

  const title = profile.headline ? `${profile.name} · ${profile.headline}` : profile.name;
  const description = (profile.headline || profile.intro).replace(/\s+/g, " ").trim().slice(0, 200);
  return page(title, description, `<main><header>${header}</header>${sections.join("")}</main>`);
}

export function renderNotFound(portfolio: PublicPortfolio): string {
  return page(
    `Page not found · ${portfolio.profile.name}`,
    "",
    `<main><h1>Page not found</h1><p>This page doesn't exist. <a href="/">Go to ${escapeHtml(portfolio.profile.name)}'s portfolio</a>.</p></main>`,
  );
}

/** Light by default, dark when the visitor's system asks for it. Same colors and type scale as the app (design.md §2–3). */
export const SITE_CSS = `:root {
  color-scheme: light dark;
  --background: #f7f7f8;
  --surface: #ffffff;
  --foreground: #18181b;
  --foreground-secondary: #3f3f46;
  --muted: #5c5c66;
  --border: #e4e4e7;
  --link: #1d4ed8;
  --focus-ring: #2563eb;
}
@media (prefers-color-scheme: dark) {
  :root {
    --background: #0c0c0e;
    --surface: #141417;
    --foreground: #f4f4f5;
    --foreground-secondary: #d4d4d8;
    --muted: #a1a1aa;
    --border: #27272c;
    --link: #7aa7ff;
    --focus-ring: #7aa7ff;
  }
}
*, *::before, *::after { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body {
  margin: 0;
  background: var(--background);
  color: var(--foreground);
  font: 1rem/1.6 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
}
main {
  max-width: 46rem;
  margin: 0 auto;
  padding: 3rem 1rem 4rem;
}
header { margin-bottom: 2.5rem; }
h1 { font-size: 2rem; line-height: 1.2; margin: 0 0 0.25rem; }
h2 { font-size: 1.25rem; line-height: 1.4; margin: 2.5rem 0 0.75rem; }
h3 { font-size: 1.0625rem; line-height: 1.5; margin: 0 0 0.25rem; }
p { margin: 0 0 0.75rem; }
.headline { font-size: 1.125rem; color: var(--foreground-secondary); margin-bottom: 0.25rem; }
.meta { font-size: 0.875rem; color: var(--muted); }
.intro { margin-top: 1rem; }
a { color: var(--link); text-underline-offset: 0.15em; }
a:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 2px; border-radius: 2px; }
ul { margin: 0; padding: 0; }
.links { list-style: none; display: flex; flex-wrap: wrap; gap: 0.25rem 1rem; margin-top: 0.75rem; }
.chips { list-style: none; display: flex; flex-wrap: wrap; gap: 0.5rem; }
.chips li { border: 1px solid var(--border); border-radius: 6px; padding: 0 0.5rem; background: var(--surface); }
.bullets { padding-left: 1.25rem; margin-bottom: 0.75rem; }
.bullets li + li { margin-top: 0.25rem; }
article { border-top: 1px solid var(--border); padding-top: 1.25rem; margin-top: 1.25rem; }
section > article:first-of-type { border-top: 0; padding-top: 0; margin-top: 0; }
@media print { a { color: inherit; } }
`;

export type RenderedSite = { files: SiteFile[] };

/**
 * Every file Updater writes to the `gh-pages` branch. `portfolio.json` is
 * the same public copy as data, so the developer owns it in a reusable form.
 */
export function renderSite(portfolio: PublicPortfolio, generatedAt: string): RenderedSite {
  return {
    files: [
      { path: "index.html", content: renderIndex(portfolio) },
      { path: "404.html", content: renderNotFound(portfolio) },
      { path: "site.css", content: SITE_CSS },
      { path: "portfolio.json", content: `${JSON.stringify({ generator: "Updater", generatedAt, portfolio }, null, 2)}\n` },
      // GitHub Pages would otherwise run Jekyll over the files.
      { path: ".nojekyll", content: "" },
      {
        path: MARKER_FILE,
        content: "This branch is written by Updater when you publish your portfolio. Publishing again replaces its files.\n",
      },
    ],
  };
}
