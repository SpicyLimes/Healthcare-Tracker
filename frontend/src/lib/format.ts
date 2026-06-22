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

export function feetInchesToIn(ft: number | null, inches: number | null): number | null {
  if (ft == null && inches == null) return null;
  return (ft ?? 0) * 12 + (inches ?? 0);
}

export function inToFeetInches(totalIn: number | null): { ft: number | null; inches: number | null } {
  if (totalIn == null) return { ft: null, inches: null };
  const ft = Math.floor(totalIn / 12);
  const inches = Math.round(totalIn % 12);
  return { ft, inches };
}

export function formatHeight(totalIn: number | null): string {
  if (totalIn == null) return "—";
  const { ft, inches } = inToFeetInches(totalIn);
  return `${ft}'${inches}"`;
}
