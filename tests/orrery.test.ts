import { describe, expect, it } from 'vitest';
import { Seasons } from 'astronomy-engine';
import { gregorianToJDN, jdnFromMs } from '../src/calendars/jdn';
import { ORRERY_CONFIG as C, REGULAR_DAYS } from '../src/calendars/orrery-config';
import {
  orrery,
  orreryDate,
  orreryYearLength,
  orreryYearStart,
  orreryYearStats,
  orreryShortMonthLength,
} from '../src/calendars/orrery';

describe('Orrery year boundaries', () => {
  it('every year 2000 to 2100 is 365 or 366 days', () => {
    for (let n = 2001; n <= 2100; n++) {
      expect([365, 366]).toContain(orreryYearLength(n));
    }
  });

  it('every year starts exactly on the UTC day of the December solstice', () => {
    for (let n = 2001; n <= 2101; n++) {
      const solstice = Seasons(n - C.YEAR_NUMBER_OFFSET).dec_solstice.date.getTime();
      expect(orreryYearStart(n)).toBe(jdnFromMs(solstice));
      const d = orreryDate(orreryYearStart(n));
      expect([d.year, d.month, d.day]).toEqual([n, 1, 1]);
      const before = orreryDate(orreryYearStart(n) - 1);
      expect(before.year).toBe(n - 1);
      expect(before.month).toBe(13);
      expect(before.day).toBe(orreryShortMonthLength(n - 1));
    }
  });

  it('year 2027 starts at the December 2026 solstice (21 Dec 2026)', () => {
    expect(orreryYearStart(2027)).toBe(gregorianToJDN(2026, 12, 21));
  });

  it('short month is year length minus 360', () => {
    for (let n = 2001; n <= 2100; n++) {
      expect(orreryShortMonthLength(n)).toBe(orreryYearLength(n) - 360);
      expect([5, 6]).toContain(orreryShortMonthLength(n));
    }
  });

  it('leap years are irregular but follow the sky about 24.2 times in 100 years', () => {
    let leaps = 0;
    for (let n = 2001; n <= 2100; n++) if (orreryYearLength(n) === 366) leaps++;
    expect(leaps).toBeGreaterThanOrEqual(22);
    expect(leaps).toBeLessThanOrEqual(27);
  });
});

describe('Orrery structure', () => {
  const n = 2026;
  const start = orreryYearStart(n);
  const len = orreryYearLength(n);

  it('has 12 months of 30 days then a short month', () => {
    for (let m = 1; m <= 12; m++) {
      const first = orreryDate(start + (m - 1) * 30);
      expect([first.month, first.day]).toEqual([m, 1]);
      const last = orreryDate(start + m * 30 - 1);
      expect([last.month, last.day]).toEqual([m, 30]);
    }
    expect(orreryDate(start + 360).month).toBe(13);
    expect(orreryDate(start + len - 1).day).toBe(len - 360);
  });

  it('weeks are 10 days, 3 per month, weekday never changes year to year', () => {
    for (let i = 0; i < 360; i++) {
      const d = orreryDate(start + i);
      expect(d.weekdayNumber).toBe((i % 10) + 1);
      expect(d.week).toBe(Math.floor((i % 30) / 10) + 1);
    }
    // Same month/day in another year has the same weekday number.
    const other = orreryYearStart(2040);
    for (let i = 0; i < 360; i++) {
      expect(orreryDate(other + i).weekdayNumber).toBe(orreryDate(start + i).weekdayNumber);
    }
  });

  it('days 1 to 6 of each week are workdays, 7 to 10 are off', () => {
    for (let i = 0; i < 360; i++) {
      const d = orreryDate(start + i);
      expect(d.isWorkday).toBe(d.weekdayNumber <= 6);
    }
  });

  it('every day of the short month is a day off', () => {
    for (let i = 360; i < len; i++) {
      const d = orreryDate(start + i);
      expect(d.isFestival).toBe(true);
      expect(d.isWorkday).toBe(false);
    }
  });

  it('216 workdays in every year; days off = length - 216', () => {
    for (let y = 2001; y <= 2100; y++) {
      const s = orreryYearStats(y);
      expect(s.workdays).toBe(216);
      expect(s.daysOff).toBe(s.length - 216);
    }
    expect(REGULAR_DAYS).toBe(360);
  });
});

describe('Orrery as a Calendar', () => {
  it('bands tile the year and match fromJDN', () => {
    const start = orreryYearStart(2026);
    const spans = orrery.monthStarts(start, start + 364);
    expect(spans.length).toBeGreaterThanOrEqual(13);
    const first13 = spans.slice(0, 13);
    expect(first13.map((s) => s.end - s.start).slice(0, 12)).toEqual(Array(12).fill(30));
    expect(orrery.fromJDN(start).label).toBe('1 Month 1 2026');
  });
});
