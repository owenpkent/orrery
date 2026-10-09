/**
 * The single adapter around Intl.DateTimeFormat. Calendars that the platform
 * already implements (Hebrew, Umm al-Qura, Persian, Chinese, ...) are defined by a
 * small config object and share all of this code.
 *
 * Every lookup is at 12:00 UTC of the JDN in the UTC time zone, so results never
 * depend on the viewer's local zone. Results are memoised per JDN.
 */
import type { CalDate, Calendar, Family, MonthSpan } from './types';
import { MS_PER_DAY, UNIX_EPOCH_JDN, WEEKDAYS, weekdayIndex } from './jdn';
import { scanSpans } from './spans';

export type PartMap = Record<string, string>;

export interface IntlCalendarConfig {
  id: string;
  name: string;
  family: Family;
  region: string;
  blurb: string;
  /** Intl calendar identifier, e.g. 'hebrew'. */
  calendar: string;
  /** Shortest month length in days; lets month scans skip ahead. */
  minLen?: number;
  /** Build the date from the numeric-format parts and the long-format parts. */
  describe: (numeric: PartMap, long: PartMap, jdn: number) => Omit<CalDate, 'weekday'>;
}

function toParts(f: Intl.DateTimeFormat, d: Date): PartMap {
  const out: PartMap = {};
  for (const p of f.formatToParts(d)) out[p.type] = p.value;
  return out;
}

export function intlCalendar(cfg: IntlCalendarConfig): Calendar {
  const loc = `en-u-ca-${cfg.calendar}-nu-latn`;
  const base = { timeZone: 'UTC' } as const;
  const numFmt = new Intl.DateTimeFormat(loc, {
    ...base,
    era: 'short',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  });
  const longFmt = new Intl.DateTimeFormat(loc, {
    ...base,
    era: 'short',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const dayFmt = new Intl.DateTimeFormat(loc, { ...base, day: 'numeric' });

  const dateCache = new Map<number, CalDate>();
  const dayCache = new Map<number, number>();
  const at = (jdn: number) => new Date((jdn - UNIX_EPOCH_JDN) * MS_PER_DAY + MS_PER_DAY / 2);

  function dayOf(jdn: number): number {
    let v = dayCache.get(jdn);
    if (v === undefined) {
      v = Number(dayFmt.format(at(jdn)));
      dayCache.set(jdn, v);
    }
    return v;
  }

  function fromJDN(jdn: number): CalDate {
    let v = dateCache.get(jdn);
    if (!v) {
      const d = at(jdn);
      const n = toParts(numFmt, d);
      const l = toParts(longFmt, d);
      v = { ...cfg.describe(n, l, jdn), weekday: WEEKDAYS[weekdayIndex(jdn)] };
      if (dateCache.size > 60000) dateCache.clear();
      dateCache.set(jdn, v);
    }
    return v;
  }

  return {
    id: cfg.id,
    name: cfg.name,
    family: cfg.family,
    region: cfg.region,
    blurb: cfg.blurb,
    fromJDN,
    monthStarts(from: number, to: number): MonthSpan[] {
      return scanSpans(from, to, (j) => dayOf(j) === 1, fromJDN, cfg.minLen ?? 1);
    },
  };
}

/** Shared helper: the first integer in a string, or NaN. */
export function firstInt(s: string | undefined): number {
  const m = s ? /-?\d+/.exec(s) : null;
  return m ? Number(m[0]) : NaN;
}
