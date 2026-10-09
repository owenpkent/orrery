import { firstInt, intlCalendar } from './intl';

export const ethiopian = intlCalendar({
  id: 'ethiopic',
  name: 'Ethiopian',
  family: 'solar',
  region: 'Ethiopia',
  blurb:
    'Twelve months of 30 days plus Pagume of 5 or 6 days. Leap year every 4 years with no exceptions, so it runs 7 to 8 years behind the Gregorian count (Amete Mihret era).',
  calendar: 'ethiopic',
  minLen: 5,
  describe: (n, l) => {
    const year = firstInt(l.year);
    const month = firstInt(n.month);
    const day = firstInt(l.day);
    return { year, month, day, monthName: l.month, label: `${day} ${l.month} ${year} E.E.` };
  },
});
