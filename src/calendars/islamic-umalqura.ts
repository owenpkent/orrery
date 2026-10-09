import { firstInt, intlCalendar } from './intl';

export const islamicUmmAlQura = intlCalendar({
  id: 'islamic-umalqura',
  name: 'Islamic (Umm al-Qura)',
  family: 'lunar',
  region: 'Saudi Arabia; civil use in the Gulf',
  blurb:
    'Pure lunar year of 354 or 355 days with no intercalation, so it drifts through the seasons. Month starts come from the Saudi Umm al-Qura table (ICU data, 1300 to 1600 AH).',
  calendar: 'islamic-umalqura',
  minLen: 29,
  describe: (n, l) => {
    const year = firstInt(l.year);
    const month = firstInt(n.month);
    const day = firstInt(l.day);
    return { year, month, day, monthName: l.month, label: `${day} ${l.month} ${year} AH` };
  },
});
