import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({ pathname: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => navigation.pathname }));

// Outside an App Router, next/link skips onNavigate. This stand-in calls it on
// a plain click, as next/link's linkClicked does; the real drawer is also
// checked in a browser (memory.md, Phase B verification).
vi.mock("next/link", () => ({
  default: ({
    onNavigate,
    href,
    ...props
  }: React.ComponentProps<"a"> & { href: string; onNavigate?: (event: { preventDefault: () => void }) => void }) => (
    <a
      href={href}
      {...props}
      onClick={(event) => {
        event.preventDefault();
        onNavigate?.({ preventDefault: () => {} });
      }}
    />
  ),
}));

import { NAV_ITEMS } from "@/lib/navigation";
import { renderWithWorkspace } from "@/test/render";
import { MobileNav } from "./mobile-nav";
import { PageHeader } from "./page-header";
import { PrimaryNav } from "./primary-nav";

beforeEach(() => {
  navigation.pathname = "/";
});

describe("PrimaryNav", () => {
  it("renders every destination as a link inside the Primary landmark", () => {
    render(<PrimaryNav />);
    const nav = screen.getByRole("navigation", { name: "Primary" });
    const links = within(nav).getAllByRole("link");
    expect(links.map((link) => [link.textContent, link.getAttribute("href")])).toEqual(
      NAV_ITEMS.map((item) => [item.label, item.href]),
    );
  });

  it("marks only the current section with aria-current=page", () => {
    navigation.pathname = "/review";
    render(<PrimaryNav />);
    expect(screen.getByRole("link", { name: "Review Queue" })).toHaveAttribute("aria-current", "page");
    const others = screen.getAllByRole("link").filter((link) => link.textContent !== "Review Queue");
    for (const link of others) expect(link).not.toHaveAttribute("aria-current");
  });

  it("keeps the section active on nested routes", () => {
    navigation.pathname = "/resumes/abc";
    render(<PrimaryNav />);
    expect(screen.getByRole("link", { name: "Resumes" })).toHaveAttribute("aria-current", "page");
  });
});

describe("MobileNav", () => {
  it("opens a named drawer, closes on Escape, and returns focus", async () => {
    const user = userEvent.setup();
    renderWithWorkspace(<MobileNav />);
    const trigger = screen.getByRole("button", { name: "Open navigation" });
    await user.click(trigger);

    const drawer = await screen.findByRole("dialog", { name: "Navigation" });
    expect(within(drawer).getByRole("navigation", { name: "Primary" })).toBeInTheDocument();
    expect(within(drawer).getByRole("button", { name: "Close navigation" })).toBeInTheDocument();

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });

  it("closes when a navigation link is followed", async () => {
    const user = userEvent.setup();
    renderWithWorkspace(<MobileNav />);
    await user.click(screen.getByRole("button", { name: "Open navigation" }));
    const drawer = await screen.findByRole("dialog", { name: "Navigation" });

    await user.click(within(drawer).getByRole("link", { name: "Sources" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});

describe("PageHeader", () => {
  it("renders the page h1 without stealing focus on the initial load", () => {
    render(<PageHeader title="Overview" description="Where your portfolio stands." />);
    const heading = screen.getByRole("heading", { level: 1, name: "Overview" });
    expect(heading).toHaveAttribute("tabindex", "-1");
    expect(heading).not.toHaveFocus();
  });

  it("moves focus to the h1 after a client-side navigation", () => {
    window.history.pushState({}, "", "/sources");
    try {
      render(<PageHeader title="Sources" />);
      expect(screen.getByRole("heading", { level: 1, name: "Sources" })).toHaveFocus();
    } finally {
      window.history.pushState({}, "", "/");
    }
  });
});
