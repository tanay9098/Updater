import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/** Decorative spinner. Pair it with text or aria-busy; it has no name of its own. */
export function Spinner({ className }: { className?: string }) {
  return (
    <LoaderCircle
      aria-hidden="true"
      size={16}
      strokeWidth={1.75}
      className={cn("shrink-0 animate-spin", className)}
    />
  );
}
