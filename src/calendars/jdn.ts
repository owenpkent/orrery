/**
 * Julian Day Number helpers. The pivot for every calendar is the integer JDN of a
 * UTC civil day, so 2000-01-01 is 2451545 (that day's noon is JD 2451545.0).
 */

export const UNIX_EPOCH_JDN = 2440588; // 1970-01-01
export const MS_PER_DAY = 86400000;

const floorDiv = (a: number, b: number): number => Math.floor(a / b);

/** Proleptic Gregorian to JDN. Month 1..12. Astronomical year numbering (year 0 exists). */
export function gregorianToJDN(y: number, m: number, d: number): number {
  const a = floorDiv(14 - m, 12);
  const yy = y + 4800 - a;
  const mm = m + 12 * a - 3;
  return (
    d +
    floorDiv(153 * mm + 2, 5) +
    365 * yy +
    floorDiv(yy, 4) -
    floorDiv(yy, 100) +
    floorDiv(yy, 400) -
    32045
  );
}

export function jdnToGregorian(jdn: number): { year: number; month: number; day: number } {
  const a = jdn + 32044;
  const b = floorDiv(4 * a + 3, 146097);
  const c = a - floorDiv(146097 * b, 4);
  const d = floorDiv(4 * c + 3, 1461);
  const e = c - floorDiv(1461 * d, 4);
  const m = floorDiv(5 * e + 2, 153);
  return {
    day: e - floorDiv(153 * m + 2, 5) + 1,
    month: m + 3 - 12 * floorDiv(m, 10),
    year: 100 * b + d - 4800 + floorDiv(m, 10),
  };
}

/** Proleptic Julian calendar to JDN. */
export function julianToJDN(y: number, m: number, d: number): number {
  const a = floorDiv(14 - m, 12);
  const yy = y + 4800 - a;
  const mm = m + 12 * a - 3;
  return d + floorDiv(153 * mm + 2, 5) + 365 * yy + floorDiv(yy, 4) - 32083;
}

export function jdnToJulian(jdn: number): { year: number; month: number; day: number } {
  const c = jdn + 32082;
  const d = floorDiv(4 * c + 3, 1461);
  const e = c - floorDiv(1461 * d, 4);
  const m = floorDiv(5 * e + 2, 153);
  return {
    day: e - floorDiv(153 * m + 2, 5) + 1,
    month: m + 3 - 12 * floorDiv(m, 10),
    year: d - 4800 + floorDiv(m, 10),
  };
}

/** JDN of the UTC civil day containing an instant (ms since the Unix epoch). */
export function jdnFromMs(ms: number): number {
  return UNIX_EPOCH_JDN + Math.floor(ms / MS_PER_DAY);
}

/** A Date at 12:00 UTC on the given JDN. */
export function dateAtNoon(jdn: number): Date {
  return new Date((jdn - UNIX_EPOCH_JDN) * MS_PER_DAY + MS_PER_DAY / 2);
}

/** Start of the UTC civil day (00:00 UTC) in ms. */
export function msAtMidnight(jdn: number): number {
  return (jdn - UNIX_EPOCH_JDN) * MS_PER_DAY;
}

/** Continuous Julian Date of an instant in ms. */
export function jdFromMs(ms: number): number {
  return ms / MS_PER_DAY + 2440587.5;
}

export function msFromJd(jd: number): number {
  return (jd - 2440587.5) * MS_PER_DAY;
}

/** Day of week, 0 = Sunday. */
export function weekdayIndex(jdn: number): number {
  return (((jdn + 1) % 7) + 7) % 7;
}

export const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

export const GREGORIAN_MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function isGregorianLeap(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** "2026-10-09" style ISO string for a JDN (astronomical years, 4+ digits). */
export function jdnToIso(jdn: number): string {
  const { year, month, day } = jdnToGregorian(jdn);
  const sign = year < 0 ? '-' : '';
  return `${sign}${String(Math.abs(year)).padStart(4, '0')}-${pad2(month)}-${pad2(day)}`;
}

export function isoToJdn(s: string): number | null {
  const m = /^(-?\d{4,6})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return gregorianToJDN(Number(m[1]), mo, d);
}

/** Today's local calendar date as a JDN. */
export function todayJDN(): number {
  const n = new Date();
  return gregorianToJDN(n.getFullYear(), n.getMonth() + 1, n.getDate());
}
