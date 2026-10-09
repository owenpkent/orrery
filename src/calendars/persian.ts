import { firstInt, intlCalendar } from './intl';

export const persian = intlCalendar({
  id: 'persian',
  name: 'Persian (Solar Hijri)',
  family: 'solar',
  region: 'Iran; Afghanistan',
  blurb:
    'Year begins at the March equinox (Nowruz). Six months of 31 days, five of 30, one of 29 or 30. Extremely accurate. Intl uses an arithmetic 33-year rule that matches the observed calendar in the modern era.',
  calendar: 'persian',
  minLen: 29,
  describe: (n, l) => {
    const year = firstInt(l.year);
    const month = firstInt(n.month);
    const day = firstInt(l.day);
    return { year, month, day, monthName: l.month, label: `${day} ${l.month} ${year} SH` };
  },
});
