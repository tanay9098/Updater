import { HardDrive } from "lucide-react";

/**
 * Sidebar footer. Until workspace storage exists (T3.3) this states what is
 * actually stored instead of showing a save status that could not be true.
 */
export function StorageNote() {
  return (
    <p className="flex items-start gap-2 text-meta font-medium text-muted">
      <HardDrive aria-hidden="true" size={16} strokeWidth={1.75} className="shrink-0" />
      <span>Only your theme preference is saved, in this browser. Workspace storage isn&apos;t built yet.</span>
    </p>
  );
}
