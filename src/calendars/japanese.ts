import { firstInt, intlCalendar } from './intl';

export const japaneseEra = intlCalendar({
  id: 'japanese',
  name: 'Japanese era',
  family: 'solar',
  region: 'Japan',
  blurb:
    'Gregorian months and days, but years count from the accession of each emperor (Reiwa since 2019). Before 1873 the real calendar was lunisolar; Intl maps eras onto Gregorian dates.',
  calendar: 'japanese',
  minLen: 28,
  describe: (n, l) => {
    const year = firstInt(l.year);
    const month = firstInt(n.month);
    const day = firstInt(l.day);
    const era = (l.era ?? '').replace(/\s*\(.*\)/, '');
    return {
      year,
      month,
      day,
      monthName: l.month,
      label: `${era} ${year === 1 ? 'gannen (1)' : year}, ${l.month} ${day}`,
    };
  },
});
