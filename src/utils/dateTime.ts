/**
 * South African Standard Time (SAST) date/time utilities
 * Timezone: Africa/Johannesburg (UTC+2)
 * Locale: en-ZA
 */

export const SAST_TIMEZONE = "Africa/Johannesburg";
export const SAST_LOCALE = "en-ZA";

/**
 * Returns the current date/time as a Date object adjusted to SAST.
 */
export function nowInSAST(): Date {
  // Use Intl to get SAST wall-clock parts, then reconstruct a local Date
  const formatter = new Intl.DateTimeFormat("en-ZA", {
    timeZone: SAST_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value || "0";
  // Construct as local date string parsed by Date
  return new Date(
    `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}`
  );
}

/**
 * Returns today's date in SAST as "yyyy-MM-dd"
 */
export function todayInSAST(): string {
  return nowInSAST().toISOString().split("T")[0];
}

/**
 * Formats a date string/Date to SAST display format.
 * @param date - ISO string or Date
 * @param options - Intl.DateTimeFormatOptions
 */
export function formatInSAST(
  date: string | Date | null | undefined,
  options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }
): string {
  if (!date) return "—";
  try {
    const d = typeof date === "string" ? new Date(date) : date;
    if (isNaN(d.getTime())) return "—";
    return new Intl.DateTimeFormat(SAST_LOCALE, {
      timeZone: SAST_TIMEZONE,
      ...options,
    }).format(d);
  } catch {
    return "—";
  }
}

/**
 * Formats a date string to a long readable SAST date.
 * e.g. "15 January 2025"
 */
export function formatDateLong(date: string | Date | null | undefined): string {
  return formatInSAST(date, { year: "numeric", month: "long", day: "numeric" });
}

/**
 * Formats a date string to short SAST date.
 * e.g. "15 Jan 2025"
 */
export function formatDateShort(date: string | Date | null | undefined): string {
  return formatInSAST(date, { year: "numeric", month: "short", day: "numeric" });
}

/**
 * Formats a date string to SAST date + time.
 * e.g. "15 Jan 2025, 09:00"
 */
export function formatDateTimeShort(date: string | Date | null | undefined): string {
  return formatInSAST(date, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/**
 * Formats just the time portion in SAST.
 * e.g. "09:00"
 */
export function formatTimeSAST(date: string | Date | null | undefined): string {
  return formatInSAST(date, { hour: "2-digit", minute: "2-digit", hour12: false });
}

/**
 * Returns the SAST year/month/day numbers for the current moment.
 */
export function sastNowParts() {
  const n = nowInSAST();
  return {
    year: n.getFullYear(),
    month: n.getMonth() + 1,
    day: n.getDate(),
    hour: n.getHours(),
    minute: n.getMinutes(),
  };
}
