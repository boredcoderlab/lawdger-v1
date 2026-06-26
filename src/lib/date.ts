/**
 * IST (Asia/Kolkata, UTC+05:30) date helpers.
 *
 * IST does not observe DST, so a fixed 5h30m offset is exact.
 */

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/**
 * Returns a Date whose UTC instant equals today's IST midnight (00:00:00+05:30).
 * Used by `createNote` to gate the auto-event branch: a "Next Date" with a
 * `nextDate` earlier than this instant is treated as in the past and the
 * calendar event is skipped.
 */
export function startOfTodayIST(): Date {
  const now = new Date();
  const istNow = new Date(now.getTime() + IST_OFFSET_MS);
  istNow.setUTCHours(0, 0, 0, 0);
  return new Date(istNow.getTime() - IST_OFFSET_MS);
}

/**
 * Returns a Date whose UTC instant equals today's IST end-of-day (23:59:59.999+05:30).
 */
export function endOfTodayIST(): Date {
  const now = new Date();
  const istNow = new Date(now.getTime() + IST_OFFSET_MS);
  istNow.setUTCHours(23, 59, 59, 999);
  return new Date(istNow.getTime() - IST_OFFSET_MS);
}

/**
 * IST date key in YYYY-MM-DD form. Used to group/compare dates by IST day
 * regardless of server timezone.
 */
export function istDateKey(d: Date): string {
  const ist = new Date(d.getTime() + IST_OFFSET_MS);
  return ist.toISOString().slice(0, 10);
}

/**
 * Formats a Date as "D MMM YYYY" in IST (e.g., "1 Jan 2026", "26 Jun 2026").
 */
export function formatIndianDate(d: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(d);
}
