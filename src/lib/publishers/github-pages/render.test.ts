import { describe, expect, it } from "vitest";
import type { PublicPortfolio } from "@/lib/validation/publication";
import { MARKER_FILE, SITE_FILES, escapeHtml, renderIndex, renderSite } from "./render";

const PORTFOLIO: PublicPortfolio = {
  profile: {
    name: "Sam Rivera",
    headline: "Developer",
    intro: "First paragraph.\n\nSecond paragraph\nwith a line break.",
    location: "Lisbon",
    links: [{ label: "Code", url: "https://example.com/sam" }],
  },
  skills: ["TypeScript"],
  projects: [
    {
      name: "Garden planner",
      summary: "A planner for allotment plots.",
      technologies: ["TypeScript", "SQLite"],
      achievements: ["Used by a gardening club."],
      links: [{ label: "Repository", url: "https://example.com/garden" }],
    },
  ],
  achievements: ["Wrote an article."],
};

describe("renderSite (T10.9)", () => {
  it("writes exactly the site files, including the marker and portfolio.json", () => {
    const { files } = renderSite(PORTFOLIO, "2026-10-31T10:00:00.000Z");
    expect(files.map((file) => file.path)).toEqual([...SITE_FILES]);
    const data = JSON.parse(files.find((file) => file.path === "portfolio.json")!.content);
    expect(data).toEqual({ generator: "Updater", generatedAt: "2026-10-31T10:00:00.000Z", portfolio: PORTFOLIO });
    expect(files.find((file) => file.path === MARKER_FILE)!.content).toContain("Updater");
  });

  it("renders what the preview shows, in the same order", () => {
    const html = renderIndex(PORTFOLIO);
    const order = ["<h1>Sam Rivera</h1>", "class=\"headline\">Developer", "class=\"meta\">Lisbon", "First paragraph.", "Code", "Skills", "Projects", "Garden planner", "Other achievements"];
    const positions = order.map((text) => html.indexOf(text));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(html).toContain("<p>Second paragraph<br>with a line break.</p>");
    expect(html).toContain("TypeScript · SQLite");
    expect(html).toContain('<a href="https://example.com/garden" rel="noopener noreferrer">Repository</a>');
  });

  it("has no scripts and a restrictive content security policy", () => {
    const html = renderIndex(PORTFOLIO);
    expect(html).not.toMatch(/<script/i);
    expect(html).toContain(`default-src 'none'; style-src 'self'`);
    expect(html).toContain('<html lang="en">');
  });

  it("escapes every piece of text, so a portfolio can't add markup", () => {
    const hostile: PublicPortfolio = {
      ...PORTFOLIO,
      profile: { ...PORTFOLIO.profile, name: `<script>alert(1)</script>`, headline: `" onmouseover="x` },
      skills: ["<img src=x onerror=alert(1)>"],
    };
    const html = renderIndex(hostile);
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("&quot; onmouseover=&quot;x");
  });

  it("renders unsafe links as text, never as a link", () => {
    const html = renderIndex({
      ...PORTFOLIO,
      profile: { ...PORTFOLIO.profile, links: [{ label: "Bad", url: "javascript:alert(1)" }] },
    });
    expect(html).not.toContain("javascript:");
    expect(html).toContain("<li>Bad</li>");
  });

  it("escapes the five HTML-significant characters", () => {
    expect(escapeHtml(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&#39;");
  });
});
