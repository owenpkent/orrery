import { describe, expect, it } from 'vitest';
import { CALENDARS, getCalendar } from '../src/calendars';
import { gregorianToJDN, jdnToGregorian, julianToJDN, jdnToJulian } from '../src/calendars/jdn';
import { islamicCivilFromJDN, islamicYearStart } from '../src/calendars/islamic-civil';
import { frenchFromJDN, frenchIsLeap } from '../src/calendars/french-republican';
import { mayaFromJDN } from '../src/calendars/maya';
import { egyptianFromJDN } from '../src/calendars/egyptian';

const g = (y: number, m: number, d: number) => gregorianToJDN(y, m, d);

describe('JDN pivot', () => {
  it('2000-01-01 is 2451545', () => {
    expect(g(2000, 1, 1)).toBe(2451545);
  });
  it('Unix epoch is 2440588', () => {
    expect(g(1970, 1, 1)).toBe(2440588);
  });
  it('round trips Gregorian over a wide range', () => {
    for (let j = g(-500, 1, 1); j < g(3000, 1, 1); j += 997) {
      const d = jdnToGregorian(j);
      expect(g(d.year, d.month, d.day)).toBe(j);
    }
  });
  it('round trips Julian', () => {
    for (let j = 1000000; j < 2600000; j += 991) {
      const d = jdnToJulian(j);
      expect(julianToJDN(d.year, d.month, d.day)).toBe(j);
    }
  });
});

describe('Julian vs Gregorian', () => {
  it('Julian 1582-10-04 is the day before Gregorian 1582-10-15', () => {
    expect(julianToJDN(1582, 10, 4) + 1).toBe(g(1582, 10, 15));
  });
  it('offset is 13 days in 2026', () => {
    expect(julianToJDN(2026, 10, 9) - g(2026, 10, 9)).toBe(13);
    expect(getCalendar('julian').fromJDN(g(2026, 10, 9)).label).toContain('26 September 2026');
  });
  it('Julian 1 Jan 1 CE Julian is JDN 1721424', () => {
    expect(julianToJDN(1, 1, 1)).toBe(1721424);
  });
});

describe('ISO week date', () => {
  const iso = (y: number, m: number, d: number) =>
    getCalendar('iso-week').fromJDN(g(y, m, d)).label;
  it('2026-01-01 is 2026-W01-4', () => expect(iso(2026, 1, 1)).toBe('2026-W01-4'));
  it('2021-01-03 is 2020-W53-7', () => expect(iso(2021, 1, 3)).toBe('2020-W53-7'));
  it('2024-12-30 is 2025-W01-1', () => expect(iso(2024, 12, 30)).toBe('2025-W01-1'));
});

describe('Maya', () => {
  it('13.0.0.0.0 is 2012-12-21', () => {
    expect(mayaFromJDN(g(2012, 12, 21)).longCount).toEqual([13, 0, 0, 0, 0]);
  });
  it('13.0.0.0.0 is 4 Ajaw 3 Kankin', () => {
    const m = mayaFromJDN(g(2012, 12, 21));
    expect([m.tzolkinNumber, m.tzolkinName, m.haabDay, m.haabName]).toEqual([
      4,
      'Ajaw',
      3,
      "K'ank'in",
    ]);
  });
  it("creation date 0.0.0.0.0 is 4 Ajaw 8 Kumk'u", () => {
    const m = mayaFromJDN(584283);
    expect([m.tzolkinNumber, m.tzolkinName, m.haabDay, m.haabName]).toEqual([
      4,
      'Ajaw',
      8,
      "Kumk'u",
    ]);
  });
});

describe('French Republican (Romme rule)', () => {
  it('1 Vendemiaire An I is 1792-09-22', () => {
    expect(frenchFromJDN(g(1792, 9, 22))).toEqual({ year: 1, month: 1, day: 1 });
  });
  it('Romme rule is one day off the historical 18 Brumaire An VIII (1799-11-09)', () => {
    // Historically year 3 was leap, Romme makes year 4 leap, so 1795 to 1803 differ by a day.
    expect(frenchFromJDN(g(1799, 11, 9))).toEqual({ year: 8, month: 2, day: 19 });
  });
  it('1 Vendemiaire An XIV is 1805-09-23', () => {
    expect(frenchFromJDN(g(1805, 9, 23))).toEqual({ year: 14, month: 1, day: 1 });
  });
  it('leap rule', () => {
    expect([4, 8, 100, 200, 400].map(frenchIsLeap)).toEqual([true, true, false, false, true]);
  });
  it('year 4 has a 6th complementary day on 1796-09-21', () => {
    expect(frenchFromJDN(g(1796, 9, 21))).toEqual({ year: 4, month: 13, day: 6 });
  });
});

describe('Egyptian civil', () => {
  it('epoch 26 Feb 747 BCE (Julian) is JDN 1448638', () => {
    expect(julianToJDN(-746, 2, 26)).toBe(1448638);
    expect(egyptianFromJDN(1448638)).toEqual({ year: 1, month: 1, day: 1 });
  });
  it('is always 365 days per year', () => {
    expect(egyptianFromJDN(1448638 + 365)).toEqual({ year: 2, month: 1, day: 1 });
    expect(egyptianFromJDN(1448638 + 364)).toEqual({ year: 1, month: 13, day: 5 });
  });
});

describe('Islamic tabular civil', () => {
  it('1 Muharram AH 1 is 16 July 622 Julian', () => {
    expect(islamicCivilFromJDN(julianToJDN(622, 7, 16))).toEqual({ year: 1, month: 1, day: 1 });
  });
  it('is within one day of Umm al-Qura for 1447 Muharram', () => {
    const uq = getCalendar('islamic-umalqura');
    const j = g(2025, 6, 26);
    expect(uq.fromJDN(j).label).toContain('1 Muharram 1447');
    expect(Math.abs(islamicYearStart(1447) - j)).toBeLessThanOrEqual(1);
  });
});

describe('Intl-backed calendars: known dates', () => {
  it('Hebrew: Rosh Hashanah', () => {
    const h = getCalendar('hebrew');
    expect(h.fromJDN(g(2024, 10, 3)).label).toBe('1 Tishri 5785');
    expect(h.fromJDN(g(2025, 9, 23)).label).toBe('1 Tishri 5786');
    expect(h.fromJDN(g(2026, 9, 12)).label).toBe('1 Tishri 5787');
  });
  it('Islamic Umm al-Qura: 1 Muharram 1447 and 1 Ramadan 1446', () => {
    const u = getCalendar('islamic-umalqura');
    expect(u.fromJDN(g(2025, 6, 26)).label).toBe('1 Muharram 1447 AH');
    expect(u.fromJDN(g(2025, 3, 1)).label).toBe('1 Ramadan 1446 AH');
  });
  it('Persian: Nowruz', () => {
    const p = getCalendar('persian');
    expect(p.fromJDN(g(2024, 3, 20)).label).toBe('1 Farvardin 1403 SH');
    expect(p.fromJDN(g(2025, 3, 21)).label).toBe('1 Farvardin 1404 SH');
    expect(p.fromJDN(g(2026, 3, 21)).label).toBe('1 Farvardin 1405 SH');
  });
  it('Chinese New Year', () => {
    const c = getCalendar('chinese');
    for (const [y, m, d] of [
      [2024, 2, 10],
      [2025, 1, 29],
      [2026, 2, 17],
    ]) {
      const cd = c.fromJDN(g(y, m, d));
      expect([cd.month, cd.day]).toEqual([1, 1]);
      expect(cd.year).toBe(y);
    }
    expect(c.fromJDN(g(2024, 2, 10)).extra).toContain('Dragon');
    expect(c.fromJDN(g(2026, 2, 17)).extra).toContain('Horse');
  });
  it('Korean Dangi: 2025 Seollal is 29 January', () => {
    const cd = getCalendar('dangi').fromJDN(g(2025, 1, 29));
    expect([cd.month, cd.day]).toEqual([1, 1]);
  });
  it('Indian national: 1 Chaitra', () => {
    const i = getCalendar('indian');
    expect(i.fromJDN(g(2024, 3, 21)).label).toContain('1 Chaitra 1946');
    expect(i.fromJDN(g(2025, 3, 22)).label).toContain('1 Chaitra 1947');
  });
  it('Ethiopian new year', () => {
    const e = getCalendar('ethiopic');
    expect(e.fromJDN(g(2023, 9, 12)).label).toContain('1 Meskerem 2016');
    expect(e.fromJDN(g(2024, 9, 11)).label).toContain('1 Meskerem 2017');
  });
  it('Coptic new year', () => {
    const c = getCalendar('coptic');
    expect(c.fromJDN(g(2023, 9, 12)).label).toContain('1 Tout 1740');
    expect(c.fromJDN(g(2024, 9, 11)).label).toContain('1 Tout 1741');
  });
  it('Thai Buddhist, ROC, Japanese era', () => {
    expect(getCalendar('buddhist').fromJDN(g(2025, 1, 1)).year).toBe(2568);
    expect(getCalendar('roc').fromJDN(g(2025, 1, 1)).year).toBe(114);
    expect(getCalendar('japanese').fromJDN(g(2019, 5, 1)).label).toContain('Reiwa');
    expect(getCalendar('japanese').fromJDN(g(2019, 4, 30)).label).toContain('Heisei');
  });
});

describe('Other calendars', () => {
  it('Holocene adds 10000', () => {
    expect(getCalendar('holocene').fromJDN(g(2000, 1, 1)).label).toBe('1 January 12000 HE');
  });
  it('JDN and Unix time', () => {
    expect(getCalendar('jdn').fromJDN(g(2000, 1, 1)).label).toBe('2,451,545');
    expect(getCalendar('unix').fromJDN(g(1970, 1, 2)).label).toBe('86,400 s');
    expect(getCalendar('unix').fromJDN(g(2000, 1, 1)).label).toBe('946,684,800 s');
  });
});

describe('Registry contract', () => {
  const from = g(2026, 1, 1);
  const to = g(2026, 12, 31);
  it('has unique ids and 22 calendars', () => {
    expect(new Set(CALENDARS.map((c) => c.id)).size).toBe(CALENDARS.length);
    expect(CALENDARS.length).toBe(22);
  });
  for (const cal of CALENDARS) {
    it(`${cal.id}: bands tile the window and fromJDN is consistent`, () => {
      const spans = cal.monthStarts(from, to);
      expect(spans.length).toBeGreaterThan(0);
      expect(spans[0].start).toBeLessThanOrEqual(from);
      expect(spans[spans.length - 1].end).toBeGreaterThan(to);
      for (let i = 0; i < spans.length; i++) {
        expect(spans[i].end).toBeGreaterThan(spans[i].start);
        if (i > 0) expect(spans[i].start).toBe(spans[i - 1].end);
      }
      for (const s of spans.slice(0, 40)) {
        expect(cal.fromJDN(s.start).monthName).toBe(s.label);
        if (s.start > from) expect(cal.fromJDN(s.start - 1).monthName === s.label).toBe(false);
      }
      const d = cal.fromJDN(g(2026, 10, 9));
      expect(d.label.length).toBeGreaterThan(0);
      expect(d.label).not.toMatch(/undefined|NaN/);
    });
  }
});
