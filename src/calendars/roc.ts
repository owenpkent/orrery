import { firstInt, intlCalendar } from './intl';

export const roc = intlCalendar({
  id: 'roc',
  name: 'ROC (Minguo)',
  family: 'solar',
  region: 'Taiwan (Republic of China)',
  blurb:
    'Gregorian months and days, with years counted from the founding of the Republic in 1912: Minguo year = Gregorian year - 1911.',
  calendar: 'roc',
  minLen: 28,
  describe: (n, l) => {
    const year = firstInt(l.year);
    const month = firstInt(n.month);
    const day = firstInt(l.day);
    return { year, month, day, monthName: l.month, label: `${day} ${l.month}, Minguo ${year}` };
  },
});
