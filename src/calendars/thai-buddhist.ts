import { firstInt, intlCalendar } from './intl';

export const thaiBuddhist = intlCalendar({
  id: 'buddhist',
  name: 'Thai Buddhist',
  family: 'solar',
  region: 'Thailand',
  blurb:
    "The Gregorian calendar with years counted from the Buddha's death in 543 BCE, so Buddhist Era = Gregorian year + 543. Thailand began the year on 1 January in 1941.",
  calendar: 'buddhist',
  minLen: 28,
  describe: (n, l) => {
    const year = firstInt(l.year);
    const month = firstInt(n.month);
    const day = firstInt(l.day);
    return { year, month, day, monthName: l.month, label: `${day} ${l.month} ${year} BE` };
  },
});
