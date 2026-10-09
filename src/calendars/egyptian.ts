import type { CalDate, Calendar } from './types';
import { WEEKDAYS, julianToJDN, weekdayIndex } from './jdn';
import { scanSpans } from './spans';

/** 1 Thoth, Nabonassar year 1: 26 February 747 BCE (Julian), i.e. astronomical year -746. */
export const EGYPTIAN_EPOCH = julianToJDN(-746, 2, 26);

export const EGYPTIAN_MONTHS = [
  'Thoth',
  'Phaophi',
  'Athyr',
  'Choiak',
  'Tybi',
  'Mechir',
  'Phamenoth',
  'Pharmouthi',
  'Pachons',
  'Payni',
  'Epiphi',
  'Mesore',
  'Epagomenal days',
];

export function egyptianFromJDN(jdn: number): { year: number; month: number; day: number } {
  const n = jdn - EGYPTIAN_EPOCH;
  const year = Math.floor(n / 365) + 1;
  const doy = n - (year - 1) * 365;
  return { year, month: Math.floor(doy / 30) + 1, day: (doy % 30) + 1 };
}

function describe(jdn: number): CalDate {
  const { year, month, day } = egyptianFromJDN(jdn);
  const monthName = EGYPTIAN_MONTHS[month - 1];
  return {
    year,
    month,
    day,
    monthName,
    weekday: WEEKDAYS[weekdayIndex(jdn)],
    label: `${day} ${monthName}, Nabonassar ${year}`,
    extra: 'Wandering 365-day year, no leap day',
  };
}

export const egyptianCivil: Calendar = {
  id: 'egyptian',
  name: 'Egyptian civil',
  family: 'solar',
  region: 'Ancient Egypt; Ptolemy used it for astronomy',
  blurb:
    '12 months of 30 days plus 5 epagomenal days, always 365 days with no leap year, so it slides one day against the seasons every 4 years. Years numbered here by the era of Nabonassar (747 BCE).',
  fromJDN: describe,
  monthStarts: (from, to) => scanSpans(from, to, (j) => egyptianFromJDN(j).day === 1, describe, 5),
};
