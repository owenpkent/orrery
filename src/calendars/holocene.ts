import type { CalDate, Calendar } from './types';
import { GREGORIAN_MONTHS, WEEKDAYS, jdnToGregorian, weekdayIndex } from './jdn';
import { scanSpans } from './spans';

function describe(jdn: number): CalDate {
  const g = jdnToGregorian(jdn);
  const year = g.year + 10000;
  return {
    year,
    month: g.month,
    day: g.day,
    monthName: GREGORIAN_MONTHS[g.month - 1],
    weekday: WEEKDAYS[weekdayIndex(jdn)],
    label: `${g.day} ${GREGORIAN_MONTHS[g.month - 1]} ${year} HE`,
  };
}

export const holocene: Calendar = {
  id: 'holocene',
  name: 'Holocene (Human Era)',
  family: 'solar',
  region: 'Proposed by Cesare Emiliani, 1993',
  blurb:
    'Gregorian months and days with 10,000 added to the year, so year 1 sits near the start of human settlement. Year 12026 begins on 1 January 2026.',
  fromJDN: describe,
  monthStarts: (from, to) => scanSpans(from, to, (j) => jdnToGregorian(j).day === 1, describe, 28),
};
