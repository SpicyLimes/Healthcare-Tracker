/**
 * Convert a datetime-local input value (no timezone) to a UTC ISO string,
 * interpreting the input as being in the given IANA timezone.
 *
 * e.g. localToUtcIso("2026-06-22T14:00", "America/Chicago") → "2026-06-22T19:00:00.000Z"
 */
export function localToUtcIso(localDatetimeStr: string, timezone: string): string {
  if (!localDatetimeStr) return localDatetimeStr;
  const naive = new Date(localDatetimeStr + "Z");
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(naive).map(({ type, value }) => [type, value])
  );
  const tzLocal = new Date(
    `${parts.year}-${parts.month}-${parts.day}T${parts.hour === "24" ? "00" : parts.hour}:${parts.minute}:${parts.second}Z`
  );
  const offsetMs = tzLocal.getTime() - naive.getTime();
  const utc = new Date(naive.getTime() - offsetMs);
  return utc.toISOString();
}

/**
 * Format a UTC ISO string for display in the given IANA timezone.
 *
 * e.g. formatInTimezone("2026-06-22T19:00:00Z", "America/Chicago") → "Jun 22, 2026, 2:00 PM"
 */
export function formatInTimezone(isoUtc: string | null | undefined, timezone: string): string {
  if (!isoUtc) return "—";
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(isoUtc));
  } catch {
    return isoUtc;
  }
}
