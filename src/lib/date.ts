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
