/**
 * Period helpers for summaries.
 *
 * All boundaries are computed in UTC and stored as UTC Date objects. The client
 * sends plain YYYY-MM-DD dates, which we anchor at UTC midnight, so a user's
 * "1 March" transaction never slips into February because of a timezone offset.
 */

export function startOfMonthUTC(year, month /* 1-12 */) {
  return new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
}

export function endOfMonthUTC(year, month /* 1-12 */) {
  return new Date(Date.UTC(year, month, 1, 0, 0, 0, 0) - 1);
}

export function startOfYearUTC(year) {
  return new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
}

export function endOfYearUTC(year) {
  return new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0, 0) - 1);
}

/** Parse a YYYY-MM-DD or ISO string into a UTC Date, or return null. */
export function parseDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value));
  if (match) {
    return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** "2026-03" style period key used to group monthly summaries. */
export function monthKey(date) {
  const d = new Date(date);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function currentPeriod(now = new Date()) {
  return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
}
