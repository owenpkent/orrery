import type { Calendar } from './types';
import { GREGORIAN_MONTHS, WEEKDAYS, jdnToJulian, weekdayIndex } from './jdn';
import { scanSpans } from './spans';

function describe(jdn: number) {
  const g = jdnToJulian(jdn);
  const yearLabel = g.year > 0 ? String(g.year) : `${1 - g.year} BCE`;
  return {
    year: g.year,
    month: g.month,
    day: g.day,
    monthName: GREGORIAN_MONTHS[g.month - 1],
    weekday: WEEKDAYS[weekdayIndex(jdn)],
    label: `${g.day} ${GREGORIAN_MONTHS[g.month - 1]} ${yearLabel} (O.S.)`,
  };
}

export const julian: Calendar = {
  id: 'julian',
  name: 'Julian',
  family: 'solar',
  region: 'Roman Empire; Orthodox liturgical use',
  blurb:
    'Leap day every four years, no exceptions, so it runs 13 days behind the Gregorian calendar today. Proleptic before 45 BCE.',
  fromJDN: describe,
  monthStarts: (from, to) => scanSpans(from, to, (j) => jdnToJulian(j).day === 1, describe, 28),
};
