import type { ReactNode } from "react";
import { ExternalLink as ExternalLinkIcon } from "lucide-react";
import { safeExternalUrl } from "@/lib/validation/url";
import { cn } from "@/lib/utils/cn";

/**
 * Link to an untrusted external URL (rules.md §7.3.6). Only http(s) URLs
 * render as links; anything else renders as nothing. Opens in a new tab with
 * `rel="noopener noreferrer"` and says so to screen readers. Demo links are
 * labeled as example.com placeholders.
 */
export function ExternalLink({
  href,
  children,
  isDemo = false,
  className,
}: {
  href: string | undefined;
  children: ReactNode;
  isDemo?: boolean;
  className?: string;
}) {
  const safe = safeExternalUrl(href);
  if (!safe) return null;
  return (
    <a
      href={safe}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex items-center gap-1 rounded-sm text-link underline underline-offset-4 hover:decoration-2",
        className,
      )}
    >
      {children}
      {isDemo ? <span className="text-muted no-underline"> (demo link, example.com)</span> : null}
      <ExternalLinkIcon aria-hidden="true" size={14} strokeWidth={1.75} className="shrink-0" />
      <span className="sr-only"> (opens in new tab)</span>
    </a>
  );
}
