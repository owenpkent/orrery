import { firstInt, intlCalendar } from './intl';

const ORDER = [
  'Tishri',
  'Heshvan',
  'Kislev',
  'Tevet',
  'Shevat',
  'Adar I',
  'Adar',
  'Adar II',
  'Nisan',
  'Iyar',
  'Sivan',
  'Tamuz',
  'Av',
  'Elul',
];

export const hebrew = intlCalendar({
  id: 'hebrew',
  name: 'Hebrew',
  family: 'lunisolar',
  region: 'Jewish communities; Israel',
  blurb:
    'Months follow the moon; a 13th month (Adar I) is added in 7 of every 19 years to hold the festivals in their seasons. Day starts at sunset, shown here by civil day.',
  calendar: 'hebrew',
  minLen: 29,
  describe: (n, l) => {
    const name = l.month ?? n.month;
    const idx = ORDER.indexOf(name);
    const month = idx < 0 ? 0 : idx <= 5 ? idx + 1 : idx;
    const year = firstInt(l.year);
    const day = firstInt(l.day);
    return {
      year,
      month,
      day,
      monthName: name,
      label: `${day} ${name} ${year}`,
    };
  },
});
