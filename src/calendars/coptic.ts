import { firstInt, intlCalendar } from './intl';

export const coptic = intlCalendar({
  id: 'coptic',
  name: 'Coptic',
  family: 'solar',
  region: 'Egypt; Coptic Orthodox Church',
  blurb:
    'Descended from the Egyptian civil calendar with a leap day added every 4 years. Twelve months of 30 days plus a 5 or 6 day month. Years count from 284 CE (Era of the Martyrs).',
  calendar: 'coptic',
  minLen: 5,
  describe: (n, l) => {
    const year = firstInt(l.year);
    const month = firstInt(n.month);
    const day = firstInt(l.day);
    return { year, month, day, monthName: l.month, label: `${day} ${l.month} ${year} A.M.` };
  },
});
