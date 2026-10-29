import { PrimaryNav } from "./primary-nav";
import { ProductMark } from "./product-mark";
import { StorageNote } from "./storage-note";

/** Fixed left column at ≥ lg (design.md §4). Hidden below lg, where the drawer takes over. */
export function Sidebar() {
  return (
    <div className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-border bg-surface lg:flex">
      <div className="flex h-14 shrink-0 items-center border-b border-border px-5">
        <ProductMark />
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <PrimaryNav />
      </div>
      <div className="shrink-0 border-t border-border px-5 py-4">
        <StorageNote />
      </div>
    </div>
  );
}
