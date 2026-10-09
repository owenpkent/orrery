import { firstInt, intlCalendar } from './intl';

export const indianNational = intlCalendar({
  id: 'indian',
  name: 'Indian national (Saka)',
  family: 'solar',
  region: 'India (official civil calendar, 1957)',
  blurb:
    'Year 1 is 78 CE. Chaitra, the first month, begins on 22 March (21 March in Gregorian leap years); leap years track the Gregorian ones.',
  calendar: 'indian',
  minLen: 30,
  describe: (n, l) => {
    const year = firstInt(l.year);
    const month = firstInt(n.month);
    const day = firstInt(l.day);
    return { year, month, day, monthName: l.month, label: `${day} ${l.month} ${year} Saka` };
  },
});
