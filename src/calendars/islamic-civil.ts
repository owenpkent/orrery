import type { CalDate, Calendar } from './types';
import { WEEKDAYS, weekdayIndex } from './jdn';
import { scanSpans } from './spans';

/** JDN of 1 Muharram AH 1 in the civil (Friday) epoch: 16 July 622 Julian. */
export const ISLAMIC_CIVIL_EPOCH = 1948440;

export const ISLAMIC_MONTHS = [
  'Muharram',
  'Safar',
  "Rabi' I",
  "Rabi' II",
  'Jumada I',
  'Jumada II',
  'Rajab',
  "Sha'ban",
  'Ramadan',
  'Shawwal',
  "Dhu al-Qi'dah",
  'Dhu al-Hijjah',
];

export function islamicYearStart(y: number): number {
  return ISLAMIC_CIVIL_EPOCH + 354 * (y - 1) + Math.floor((3 + 11 * y) / 30);
}

export function islamicCivilFromJDN(jdn: number): { year: number; month: number; day: number } {
  const year = Math.floor((30 * (jdn - ISLAMIC_CIVIL_EPOCH) + 10646) / 10631);
  const dayOfYear = jdn - islamicYearStart(year); // 0-based
  const month = Math.min(12, Math.floor((dayOfYear * 2) / 59) + 1);
  const monthStart = Math.ceil(29.5 * (month - 1));
  return { year, month, day: dayOfYear - monthStart + 1 };
}

function describe(jdn: number): CalDate {
  const { year, month, day } = islamicCivilFromJDN(jdn);
  const monthName = ISLAMIC_MONTHS[month - 1];
  return {
    year,
    month,
    day,
    monthName,
    weekday: WEEKDAYS[weekdayIndex(jdn)],
    label: `${day} ${monthName} ${year} AH`,
    extra: 'Tabular rule, not observation',
  };
}

export const islamicCivil: Calendar = {
  id: 'islamic-civil',
  name: 'Islamic (tabular civil)',
  family: 'lunar',
  region: 'Historical and computational use',
  blurb:
    'A fixed arithmetic version of the Islamic calendar: 30-year cycle with 11 leap years, months alternating 30 and 29 days. Can differ by a day or two from the Umm al-Qura table and from moon sighting.',
  fromJDN: describe,
  monthStarts: (from, to) =>
    scanSpans(from, to, (j) => islamicCivilFromJDN(j).day === 1, describe, 29),
};
