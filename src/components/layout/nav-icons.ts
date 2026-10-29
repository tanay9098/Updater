import { Briefcase, Database, FileText, Inbox, LayoutDashboard, Settings, type LucideIcon } from "lucide-react";
import type { NavItemId } from "@/lib/navigation";

export const NAV_ICONS: Record<NavItemId, LucideIcon> = {
  overview: LayoutDashboard,
  sources: Database,
  review: Inbox,
  portfolio: Briefcase,
  resumes: FileText,
  settings: Settings,
};
