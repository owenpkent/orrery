import type { Calendar } from './types';
import { gregorian } from './gregorian';
import { julian } from './julian';
import { isoWeekDate } from './iso-week';
import { hebrew } from './hebrew';
import { islamicUmmAlQura } from './islamic-umalqura';
import { islamicCivil } from './islamic-civil';
import { persian } from './persian';
import { chinese } from './chinese';
import { dangi } from './dangi';
import { indianNational } from './indian';
import { ethiopian } from './ethiopian';
import { coptic } from './coptic';
import { thaiBuddhist } from './thai-buddhist';
import { japaneseEra } from './japanese';
import { roc } from './roc';
import { maya } from './maya';
import { frenchRepublican } from './french-republican';
import { egyptianCivil } from './egyptian';
import { holocene } from './holocene';
import { julianDayNumber, unixTime } from './day-counts';
import { orrery } from './orrery';

/** Registry: display order for lanes and cards (grouped by family in the UI). */
export const CALENDARS: Calendar[] = [
  gregorian,
  julian,
  isoWeekDate,
  holocene,
  persian,
  indianNational,
  ethiopian,
  coptic,
  egyptianCivil,
  frenchRepublican,
  thaiBuddhist,
  japaneseEra,
  roc,
  islamicUmmAlQura,
  islamicCivil,
  hebrew,
  chinese,
  dangi,
  maya,
  julianDayNumber,
  unixTime,
  orrery,
];

export const CALENDAR_BY_ID: ReadonlyMap<string, Calendar> = new Map(
  CALENDARS.map((c) => [c.id, c]),
);

export function getCalendar(id: string): Calendar {
  const c = CALENDAR_BY_ID.get(id);
  if (!c) throw new Error(`Unknown calendar: ${id}`);
  return c;
}

export type { Calendar, CalDate, Family, MonthSpan } from './types';
export { FAMILY_LABEL, FAMILY_ORDER } from './types';
