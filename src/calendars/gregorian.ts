import type { Calendar } from './types';
import { GREGORIAN_MONTHS, WEEKDAYS, jdnToGregorian, weekdayIndex } from './jdn';
import { scanSpans } from './spans';

function describe(jdn: number) {
  const g = jdnToGregorian(jdn);
  const yearLabel = g.year > 0 ? String(g.year) : `${1 - g.year} BCE`;
  return {
    year: g.year,
    month: g.month,
    day: g.day,
    monthName: GREGORIAN_MONTHS[g.month - 1],
    weekday: WEEKDAYS[weekdayIndex(jdn)],
    label: `${g.day} ${GREGORIAN_MONTHS[g.month - 1]} ${yearLabel}`,
  };
}

export const gregorian: Calendar = {
  id: 'gregorian',
  name: 'Gregorian',
  family: 'solar',
  region: 'Worldwide civil standard',
  blurb:
    'Twelve unequal months, leap day under the 4/100/400 rule. Proleptic before 1582. The calendar the rest of this site is anchored to.',
  fromJDN: describe,
  monthStarts: (from, to) => scanSpans(from, to, (j) => jdnToGregorian(j).day === 1, describe, 28),
};
