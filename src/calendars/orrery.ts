/**
 * The Orrery calendar: an invented, sky-anchored calendar. See
 * docs/ORRERY_CALENDAR.md. All tunable choices are in orrery-config.ts.
 *
 * Year N begins on the UTC civil day containing the December solstice of
 * Gregorian year N - YEAR_NUMBER_OFFSET. Year length is the distance in days to
 * the next such day (365 or 366); the short month absorbs the remainder.
 */
import type { CalDate, Calendar, MonthSpan } from './types';
import { jdnFromMs, jdnToGregorian } from './jdn';
import { ORRERY_CONFIG as C, REGULAR_DAYS } from './orrery-config';
import { decemberSolstice } from '../sky/events';

const startCache = new Map<number, number>();

/** JDN of New Year's Day (day 1 of month 1) of Orrery year N. */
export function orreryYearStart(n: number): number {
  let v = startCache.get(n);
  if (v === undefined) {
    v = jdnFromMs(decemberSolstice(n - C.YEAR_NUMBER_OFFSET));
    startCache.set(n, v);
  }
  return v;
}

/** Instant (ms, UTC) of the solstice that begins Orrery year N. */
export function orreryYearSolsticeMs(n: number): number {
  return decemberSolstice(n - C.YEAR_NUMBER_OFFSET);
}

export function orreryYearLength(n: number): number {
  return orreryYearStart(n + 1) - orreryYearStart(n);
}

/** Days in the short year-end month of year N (5 or 6). */
export function orreryShortMonthLength(n: number): number {
  return orreryYearLength(n) - REGULAR_DAYS;
}

export function orreryMonthLength(n: number, month: number): number {
  return month <= C.REGULAR_MONTHS ? C.DAYS_PER_MONTH : orreryShortMonthLength(n);
}

export interface OrreryDate {
  year: number;
  /** 1..12 regular, 13 = short month. */
  month: number;
  /** 1..30 (1..5 or 1..6 in the short month). */
  day: number;
  /** 0-based day of the year. */
  dayOfYear: number;
  yearLength: number;
  /** 1..3, or 0 in the short month (it has no weeks). */
  week: number;
  /** 1..10 position in the 10-day week; in the short month, the day number. */
  weekdayNumber: number;
  isFestival: boolean;
  isWorkday: boolean;
}

export function orreryYearOf(jdn: number): number {
  let n = jdnToGregorian(jdn).year + C.YEAR_NUMBER_OFFSET;
  while (jdn < orreryYearStart(n)) n--;
  while (jdn >= orreryYearStart(n + 1)) n++;
  return n;
}

export function orreryDate(jdn: number): OrreryDate {
  const year = orreryYearOf(jdn);
  const dayOfYear = jdn - orreryYearStart(year);
  const yearLength = orreryYearLength(year);
  if (dayOfYear < REGULAR_DAYS) {
    const month = Math.floor(dayOfYear / C.DAYS_PER_MONTH) + 1;
    const day = (dayOfYear % C.DAYS_PER_MONTH) + 1;
    const weekdayNumber = ((day - 1) % C.WEEK_LENGTH) + 1;
    return {
      year,
      month,
      day,
      dayOfYear,
      yearLength,
      week: Math.floor((day - 1) / C.WEEK_LENGTH) + 1,
      weekdayNumber,
      isFestival: false,
      isWorkday: weekdayNumber <= C.WORKDAYS_PER_WEEK,
    };
  }
  const day = dayOfYear - REGULAR_DAYS + 1;
  return {
    year,
    month: C.REGULAR_MONTHS + 1,
    day,
    dayOfYear,
    yearLength,
    week: 0,
    weekdayNumber: day,
    isFestival: true,
    isWorkday: !C.FESTIVAL_ALL_OFF && day <= C.WORKDAYS_PER_WEEK,
  };
}

export function orreryMonthName(month: number): string {
  return month <= C.REGULAR_MONTHS ? C.MONTH_NAMES[month - 1] : C.FESTIVAL_NAME;
}

export interface OrreryYearStats {
  year: number;
  length: number;
  shortMonthLength: number;
  workdays: number;
  daysOff: number;
}

export function orreryYearStats(year: number): OrreryYearStats {
  const length = orreryYearLength(year);
  const start = orreryYearStart(year);
  let workdays = 0;
  for (let i = 0; i < length; i++) if (orreryDate(start + i).isWorkday) workdays++;
  return {
    year,
    length,
    shortMonthLength: length - REGULAR_DAYS,
    workdays,
    daysOff: length - workdays,
  };
}

function describe(jdn: number): CalDate {
  const d = orreryDate(jdn);
  const monthName = orreryMonthName(d.month);
  const dayName = C.WEEKDAY_NAMES[d.weekdayNumber - 1];
  return {
    year: d.year,
    month: d.month,
    day: d.day,
    monthName,
    weekday: dayName,
    label: `${d.day} ${monthName} ${d.year}`,
    extra: d.isFestival
      ? `${dayName}, ${d.isWorkday ? 'workday' : 'day off'} (year-end festival)`
      : `${dayName}, week ${d.week}, ${d.isWorkday ? 'workday' : 'day off'}`,
  };
}

function monthStarts(fromJdn: number, toJdn: number): MonthSpan[] {
  const out: MonthSpan[] = [];
  for (let y = orreryYearOf(fromJdn); orreryYearStart(y) <= toJdn; y++) {
    const ys = orreryYearStart(y);
    for (let m = 1; m <= C.REGULAR_MONTHS + 1; m++) {
      const start = ys + (m - 1) * C.DAYS_PER_MONTH;
      const end = m <= C.REGULAR_MONTHS ? start + C.DAYS_PER_MONTH : orreryYearStart(y + 1);
      if (end > fromJdn && start <= toJdn) {
        out.push({ start, end, label: orreryMonthName(m), year: y, month: m });
      }
    }
  }
  return out;
}

export const orrery: Calendar = {
  id: 'orrery',
  name: 'Orrery',
  family: 'invented',
  region: 'Invented for this site',
  blurb:
    'Twelve 30-day months in locked 10-day weeks plus a 5 or 6 day year-end festival. Each year begins on the UTC day of the December solstice, so leap years are decided by the sky.',
  fromJDN: describe,
  monthStarts,
};
