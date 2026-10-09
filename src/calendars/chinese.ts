import { firstInt, intlCalendar } from './intl';

export const ANIMALS = [
  'Rat',
  'Ox',
  'Tiger',
  'Rabbit',
  'Dragon',
  'Snake',
  'Horse',
  'Goat',
  'Monkey',
  'Rooster',
  'Dog',
  'Pig',
];

export function lunisolarDescribe(n: Record<string, string>, l: Record<string, string>) {
  const year = firstInt(n.relatedYear ?? l.relatedYear);
  const leap = /bis/.test(n.month ?? '');
  const month = firstInt(n.month);
  const day = firstInt(l.day);
  const animal = ANIMALS[(((year - 4) % 12) + 12) % 12];
  const monthName = `Month ${month}${leap ? ' (leap)' : ''}`;
  return {
    year,
    month,
    day,
    monthName,
    label: `${monthName}, day ${day}`,
    extra: `Year of the ${animal}${l.yearName ? ` (${l.yearName})` : ''}, starts in ${year}`,
  };
}

export const chinese = intlCalendar({
  id: 'chinese',
  name: 'Chinese',
  family: 'lunisolar',
  region: 'China; East Asian communities',
  blurb:
    'Months begin at the astronomical new moon (China Standard Time); a leap month is inserted about every 3 years so the year tracks the solar terms. New Year falls between 21 January and 20 February.',
  calendar: 'chinese',
  minLen: 29,
  describe: lunisolarDescribe,
});
