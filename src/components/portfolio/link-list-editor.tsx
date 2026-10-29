"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import type { LinkInput } from "@/features/profile/profile";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export type LinkRow = LinkInput & { key: string };

let rowCounter = 0;
export function newLinkRow(link?: LinkInput): LinkRow {
  rowCounter += 1;
  return { key: `row-${rowCounter}`, id: link?.id, label: link?.label ?? "", url: link?.url ?? "" };
}

/**
 * Label + URL rows with add, remove, and reorder buttons (design.md §11,
 * WCAG 2.5.7: no drag-only reordering). Errors are keyed "index.field".
 */
export function LinkListEditor({
  rows,
  onChange,
  errors,
  max,
  itemName = "link",
  addLabel,
}: {
  rows: LinkRow[];
  onChange: (rows: LinkRow[]) => void;
  errors: Record<string, string>;
  max: number;
  itemName?: string;
  /** Accessible name of the add button when several lists share a page, e.g. "Add link to trail-notes". */
  addLabel?: string;
}) {
  function update(index: number, patch: Partial<LinkRow>) {
    onChange(rows.map((row, position) => (position === index ? { ...row, ...patch } : row)));
  }
  function move(index: number, offset: -1 | 1) {
    const next = [...rows];
    [next[index], next[index + offset]] = [next[index + offset], next[index]];
    onChange(next);
  }

  return (
    <div className="flex flex-col gap-3">
      {rows.length === 0 ? <p className="text-support text-muted">No {itemName}s yet.</p> : null}
      {rows.map((row, index) => {
        const name = row.label || `${itemName} ${index + 1}`;
        return (
          <div key={row.key} className="flex flex-col gap-2 border-b border-border pb-3 last:border-b-0 sm:flex-row sm:items-start">
            <Field label="Label" error={errors[`${index}.label`]} className="sm:w-40">
              <Input value={row.label} maxLength={40} onChange={(event) => update(index, { label: event.target.value })} />
            </Field>
            <Field label="URL" error={errors[`${index}.url`]} className="min-w-0 flex-1">
              <Input
                type="url"
                inputMode="url"
                placeholder="https://"
                value={row.url}
                onChange={(event) => update(index, { url: event.target.value })}
              />
            </Field>
            <div className="flex gap-1 sm:pt-7">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Move ${name} up`}
                disabled={index === 0}
                onClick={() => move(index, -1)}
              >
                <ArrowUp aria-hidden="true" size={16} strokeWidth={1.75} />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Move ${name} down`}
                disabled={index === rows.length - 1}
                onClick={() => move(index, 1)}
              >
                <ArrowDown aria-hidden="true" size={16} strokeWidth={1.75} />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${name}`}
                onClick={() => onChange(rows.filter((_, position) => position !== index))}
              >
                <Trash2 aria-hidden="true" size={16} strokeWidth={1.75} />
              </Button>
            </div>
          </div>
        );
      })}
      <div>
        <Button
          variant="secondary"
          size="sm"
          aria-label={addLabel}
          disabled={rows.length >= max}
          onClick={() => onChange([...rows, newLinkRow()])}
        >
          <Plus aria-hidden="true" size={16} strokeWidth={1.75} />
          Add {itemName}
        </Button>
        {rows.length >= max ? <p className="mt-1 text-support text-muted">You can add up to {max}.</p> : null}
      </div>
    </div>
  );
}

/** Field errors from a links validation, re-keyed to "index.field". */
export function linkErrors(fieldErrors: Record<string, string> | undefined, prefix = ""): Record<string, string> {
  if (!fieldErrors) return {};
  const result: Record<string, string> = {};
  for (const [path, message] of Object.entries(fieldErrors)) {
    if (prefix && !path.startsWith(prefix)) continue;
    result[prefix ? path.slice(prefix.length) : path] = message;
  }
  return result;
}

export function sameLinks(rows: ReadonlyArray<LinkInput>, saved: ReadonlyArray<LinkInput>): boolean {
  return (
    rows.length === saved.length &&
    rows.every((row, index) => row.label === saved[index].label && row.url === saved[index].url)
  );
}
