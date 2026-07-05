/**
 * Convert a UTC ISO string to a datetime-local input value (YYYY-MM-DDTHH:mm),
 * rendering the time in the given IANA timezone so the input shows local time.
 */
export function toLocalInputValue(isoUtc: string | null | undefined, timezone: string): string {
  if (!isoUtc) return "";
  try {
    const formatter = new Intl.DateTimeFormat("sv-SE", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    return formatter.format(new Date(isoUtc)).replace(" ", "T").slice(0, 16);
  } catch {
    return isoUtc.slice(0, 16);
  }
}

/**
 * Format a Date as a datetime-local input value (YYYY-MM-DDTHH:mm) in the
 * browser's local time. Date#toISOString would render UTC and shift the time.
 */
export function dateToLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

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
