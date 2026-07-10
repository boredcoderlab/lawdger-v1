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

/**
 * True if `d` is at or after the start of today in IST.
 * Use for "next hearing" pointer comparisons where UTC-midnight all-day events
 * must remain visible through the full IST day (not vanish at 05:30 IST).
 */
export function isFutureIST(d: Date): boolean {
  return d >= startOfTodayIST();
}

/**
 * Filter a list, nulling out any item whose date field is strictly before IST-today.
 * Preserves items with null date field. Returns a new list; does not mutate.
 *
 * Used to guard cache columns (Case.nextHearingDate) that can go stale between
 * calendar mutations — server-side stale-past filter shared across dashboard/cases/case-detail.
 */
export function filterStalePastHearing<T extends { nextHearingDate: Date | null }>(
  items: T[]
): T[] {
  const floor = startOfTodayIST();
  return items.map((c) => ({
    ...c,
    nextHearingDate: c.nextHearingDate && c.nextHearingDate >= floor ? c.nextHearingDate : null,
  }));
}

/**
 * Nulls out `nextHearingDate` if it's strictly before IST-today.
 * Single-record variant of filterStalePastHearing — same guard, non-array shape.
 * Used for cache columns on single Case reads (case detail loader).
 */
export function stripStalePastHearing<T extends { nextHearingDate: Date | null }>(
  item: T
): T {
  const floor = startOfTodayIST();
  return {
    ...item,
    nextHearingDate: item.nextHearingDate && item.nextHearingDate >= floor ? item.nextHearingDate : null,
  };
}
