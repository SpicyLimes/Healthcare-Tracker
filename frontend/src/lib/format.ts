/**
 * Format an ISO datetime string to a human-readable local time.
 * e.g. "2026-06-22T09:45:00Z" → "Jun 22, 2026, 9:45 AM"
 */
export function formatDatetime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/**
 * Format an ISO date string to a human-readable date.
 * e.g. "2026-06-22" → "Jun 22, 2026"
 */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}
