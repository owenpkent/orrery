import { intlCalendar } from './intl';
import { lunisolarDescribe } from './chinese';

export const dangi = intlCalendar({
  id: 'dangi',
  name: 'Korean (Dangi)',
  family: 'lunisolar',
  region: 'Korea',
  blurb:
    'Same structure as the Chinese calendar but computed for the Korean meridian, so it differs in the occasional year when a new moon falls near midnight.',
  calendar: 'dangi',
  minLen: 29,
  describe: lunisolarDescribe,
});
