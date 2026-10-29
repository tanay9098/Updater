/**
 * Primary navigation (design.md §6). Labels, routes, and page descriptions
 * are defined once here and reused by the sidebar, the mobile drawer, the
 * top bar, and each page header so they never drift apart.
 */

export const NAV_ITEMS = [
  {
    id: "overview",
    label: "Overview",
    href: "/",
    description: "Where your portfolio stands and what to do next.",
  },
  {
    id: "sources",
    label: "Sources",
    href: "/sources",
    description: "Where Updater gets evidence of your work.",
  },
  {
    id: "review",
    label: "Review Queue",
    href: "/review",
    description: "Proposed updates. Nothing reaches your portfolio until you approve it.",
  },
  {
    id: "portfolio",
    label: "Portfolio",
    href: "/portfolio",
    description: "Edit and preview your portfolio draft.",
  },
  {
    id: "resumes",
    label: "Resumes",
    href: "/resumes",
    description: "Role-specific resume drafts built from your approved content.",
  },
  {
    id: "settings",
    label: "Settings",
    href: "/settings",
    description: "Appearance, privacy, and the data stored in this browser.",
  },
] as const;

export type NavItem = (typeof NAV_ITEMS)[number];
export type NavItemId = NavItem["id"];

export function getNavItem(id: NavItemId): NavItem {
  const item = NAV_ITEMS.find((candidate) => candidate.id === id);
  if (!item) throw new Error(`Unknown navigation item: ${id}`);
  return item;
}

/** Overview matches only "/". Other items also match their nested routes. */
export function isActiveRoute(pathname: string, href: string): boolean {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (href === "/") return path === "/";
  return path === href || path.startsWith(`${href}/`);
}

export function findActiveNavItem(pathname: string): NavItem | undefined {
  return NAV_ITEMS.find((item) => isActiveRoute(pathname, item.href));
}
