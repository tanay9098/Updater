import { ThemeToggle } from "@/components/theme/theme-toggle";
import { CurrentSection } from "./current-section";
import { DemoIndicator } from "./demo-indicator";
import { MobileNav } from "./mobile-nav";
import { ProductMark } from "./product-mark";

/** Sticky 3.5rem bar (design.md §4). Product identity and the menu button appear below lg. */
export function TopBar() {
  return (
    <header className="sticky top-0 z-30 flex print:hidden h-14 shrink-0 items-center gap-3 border-b border-border bg-surface px-4 sm:px-6 lg:px-8">
      <MobileNav />
      <div className="lg:hidden">
        <ProductMark />
      </div>
      <div className="hidden min-w-0 lg:block">
        <CurrentSection />
      </div>
      <div className="ml-auto flex items-center gap-2">
        <DemoIndicator />
        <ThemeToggle />
      </div>
    </header>
  );
}
