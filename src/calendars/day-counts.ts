import type { CalDate, Calendar } from './types';
import { UNIX_EPOCH_JDN, WEEKDAYS, weekdayIndex } from './jdn';
import { scanSpans } from './spans';

const grouped = (n: number) => n.toLocaleString('en-US');

function bandCalendar(
  id: string,
  name: string,
  region: string,
  blurb: string,
  bandDays: number,
  value: (jdn: number) => number,
  unit: string,
  offset: number,
): Calendar {
  // Bands start where (jdn - offset) is a multiple of bandDays.
  const into = (j: number) => (((j - offset) % bandDays) + bandDays) % bandDays;
  const describe = (jdn: number): CalDate => {
    const bandStart = jdn - into(jdn);
    return {
      year: 0,
      month: Math.floor((bandStart - offset) / bandDays),
      day: into(jdn) + 1,
      monthName: grouped(value(bandStart)),
      weekday: WEEKDAYS[weekdayIndex(jdn)],
      label: `${grouped(value(jdn))}${unit}`,
    };
  };
  return {
    id,
    name,
    family: 'count',
    region,
    blurb,
    fromJDN: describe,
    monthStarts: (from, to) => scanSpans(from, to, (j) => into(j) === 0, describe, bandDays),
  };
}

export const julianDayNumber = bandCalendar(
  'jdn',
  'Julian Day Number',
  'Astronomy',
  'A continuous count of days since 1 January 4713 BCE (Julian), used by astronomers to avoid calendar arithmetic. Shown for the UTC civil day. Timeline bands are 100 days.',
  100,
  (j) => j,
  '',
  0,
);

export const unixTime = bandCalendar(
  'unix',
  'Unix time',
  'Computing',
  'Seconds since 00:00 UTC on 1 January 1970, ignoring leap seconds. Shown for the start of the UTC day. Timeline bands are 10 days (864,000 s).',
  10,
  (j) => (j - UNIX_EPOCH_JDN) * 86400,
  ' s',
  UNIX_EPOCH_JDN,
);
