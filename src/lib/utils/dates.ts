/**
 * Date display helpers. Stored timestamps are ISO 8601 UTC strings; they are
 * shown in the viewer's locale and time zone. Only call these on the client
 * (workspace UI renders after hydration), so server and client never disagree.
 */

function parse(iso: string): Date | null {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "28 Oct 2026". Date-only values (YYYY-MM-DD) are shown without shifting the day. */
export function formatDate(iso: string | undefined): string {
  if (!iso) return "";
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(iso);
  const date = parse(dateOnly ? `${iso}T00:00:00Z` : iso);
  if (!date) return iso;
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(dateOnly ? { timeZone: "UTC" } : {}),
  }).format(date);
}

/** "14:02" in the viewer's locale. */
export function formatTime(iso: string | undefined): string {
  if (!iso) return "";
  const date = parse(iso);
  if (!date) return iso;
  return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(date);
}

/** "28 Oct 2026, 14:02". */
export function formatDateTime(iso: string | undefined): string {
  if (!iso) return "";
  const date = parse(iso);
  if (!date) return iso;
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

/** "Oct 2026" for resume entries. */
export function formatMonthYear(iso: string | undefined): string {
  if (!iso) return "";
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(iso);
  const date = parse(dateOnly ? `${iso}T00:00:00Z` : iso);
  if (!date) return iso;
  return new Intl.DateTimeFormat(undefined, { month: "short", year: "numeric", timeZone: "UTC" }).format(date);
}
