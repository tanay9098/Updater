import { describe, expect, it } from "vitest";
import { NAV_ITEMS, findActiveNavItem, getNavItem, isActiveRoute } from "./navigation";

describe("navigation", () => {
  it("lists the six destinations with the routes from design.md §6", () => {
    expect(NAV_ITEMS.map((item) => [item.label, item.href])).toEqual([
      ["Overview", "/"],
      ["Sources", "/sources"],
      ["Review Queue", "/review"],
      ["Portfolio", "/portfolio"],
      ["Resumes", "/resumes"],
      ["Settings", "/settings"],
    ]);
  });

  it("has unique ids and routes", () => {
    expect(new Set(NAV_ITEMS.map((item) => item.id)).size).toBe(NAV_ITEMS.length);
    expect(new Set(NAV_ITEMS.map((item) => item.href)).size).toBe(NAV_ITEMS.length);
  });

  it("matches Overview only at the root", () => {
    expect(isActiveRoute("/", "/")).toBe(true);
    expect(isActiveRoute("/sources", "/")).toBe(false);
  });

  it("matches nested routes and trailing slashes but not prefixes of other words", () => {
    expect(isActiveRoute("/resumes", "/resumes")).toBe(true);
    expect(isActiveRoute("/resumes/", "/resumes")).toBe(true);
    expect(isActiveRoute("/resumes/abc123", "/resumes")).toBe(true);
    expect(isActiveRoute("/resumes-old", "/resumes")).toBe(false);
  });

  it("finds the active item for a pathname", () => {
    expect(findActiveNavItem("/review")?.label).toBe("Review Queue");
    expect(findActiveNavItem("/resumes/abc")?.id).toBe("resumes");
    expect(findActiveNavItem("/onboarding")).toBeUndefined();
  });

  it("looks items up by id", () => {
    expect(getNavItem("settings").href).toBe("/settings");
  });
});
