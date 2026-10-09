import type { Calendar, CalDate } from './types';
import { WEEKDAYS, jdnToGregorian, gregorianToJDN, weekdayIndex, pad2 } from './jdn';
import { scanSpans } from './spans';

/** ISO 8601 week date. Weeks start Monday; week 1 contains the year's first Thursday. */
export function isoWeek(jdn: number): { year: number; week: number; dow: number } {
  const dow = ((weekdayIndex(jdn) + 6) % 7) + 1; // Monday = 1
  const thursday = jdn - dow + 4;
  const year = jdnToGregorian(thursday).year;
  const week = Math.floor((thursday - gregorianToJDN(year, 1, 1)) / 7) + 1;
  return { year, week, dow };
}

function describe(jdn: number): CalDate {
  const { year, week, dow } = isoWeek(jdn);
  return {
    year,
    month: week,
    day: dow,
    monthName: `W${pad2(week)}`,
    weekday: WEEKDAYS[weekdayIndex(jdn)],
    label: `${year}-W${pad2(week)}-${dow}`,
    extra: 'Bands are weeks, not months',
  };
}

export const isoWeekDate: Calendar = {
  id: 'iso-week',
  name: 'ISO week date',
  family: 'solar',
  region: 'International standard (ISO 8601)',
  blurb:
    'Year, week number, weekday. Weeks run Monday to Sunday and week 1 holds the first Thursday, so a year has 52 or 53 weeks. Timeline bands are weeks.',
  fromJDN: describe,
  monthStarts: (from, to) => scanSpans(from, to, (j) => weekdayIndex(j) === 1, describe, 7),
};
