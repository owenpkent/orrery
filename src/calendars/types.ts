/** Calendar plugin contract. Every calendar is one file that exports a Calendar. */

export type Family = 'solar' | 'lunar' | 'lunisolar' | 'count' | 'invented';

export const FAMILY_ORDER: Family[] = ['solar', 'lunar', 'lunisolar', 'count', 'invented'];

export const FAMILY_LABEL: Record<Family, string> = {
  solar: 'Solar',
  lunar: 'Lunar',
  lunisolar: 'Lunisolar',
  count: 'Day counts',
  invented: 'Invented',
};

export interface CalDate {
  /** Calendar year (era-relative where the calendar has eras). */
  year: number;
  /** 1-based month (or week, or band) number within the year. */
  month: number;
  /** 1-based day within the month. */
  day: number;
  monthName: string;
  weekday?: string;
  /** Short human label, e.g. "9 October 2026". */
  label: string;
  /** Optional second line, e.g. the Tzolk'in and Haab' for a Maya date. */
  extra?: string;
}

/** One band of a timeline lane: [start, end) in Julian Day Numbers. */
export interface MonthSpan {
  start: number;
  end: number;
  /** Short label for the band. */
  label: string;
  year: number;
  month: number;
}

export interface Calendar {
  id: string;
  name: string;
  family: Family;
  region: string;
  blurb: string;
  /** Julian Day Number of a UTC civil day (2451545 is 2000-01-01). */
  fromJDN(jdn: number): CalDate;
  /** Bands covering [fromJdn, toJdn]; the first may begin before fromJdn, the last may end after toJdn. */
  monthStarts(fromJdn: number, toJdn: number): MonthSpan[];
}
