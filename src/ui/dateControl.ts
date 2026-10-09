/** Mouse-first date control: steppers with hold-to-repeat, a scrub slider, and Today. */
import { getState, setDate, subscribe } from '../state';
import {
  WEEKDAYS,
  gregorianToJDN,
  isGregorianLeap,
  jdnToGregorian,
  todayJDN,
  weekdayIndex,
  GREGORIAN_MONTHS,
} from '../calendars/jdn';
import { h, repeatButton } from './dom';

export const SCRUB_MIN = gregorianToJDN(1900, 1, 1);
export const SCRUB_MAX = gregorianToJDN(2100, 12, 31);

function daysIn(y: number, m: number): number {
  return [31, isGregorianLeap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
}

/** Move by whole Gregorian months, clamping the day (31 Jan + 1 month = 28/29 Feb). */
export function addMonths(jdn: number, months: number): number {
  const g = jdnToGregorian(jdn);
  const total = g.year * 12 + (g.month - 1) + months;
  const y = Math.floor(total / 12);
  const m = total - y * 12 + 1;
  return gregorianToJDN(y, m, Math.min(g.day, daysIn(y, m)));
}

export function describeGregorian(jdn: number): string {
  const g = jdnToGregorian(jdn);
  return `${WEEKDAYS[weekdayIndex(jdn)]} ${g.day} ${GREGORIAN_MONTHS[g.month - 1]} ${g.year}`;
}

export function createDateControl(): HTMLElement {
  const step = (fn: (j: number) => number) => () => setDate(fn(getState().jdn));

  const readout = h('output', { class: 'date-readout', 'aria-live': 'polite' });
  const slider = h('input', {
    type: 'range',
    class: 'scrub',
    min: String(SCRUB_MIN),
    max: String(SCRUB_MAX),
    step: '1',
    'aria-label': 'Scrub through dates, 1900 to 2100',
  });
  slider.addEventListener('input', () => setDate(Number(slider.value)));

  const row = h(
    'div',
    { class: 'stepper-row', role: 'group', 'aria-label': 'Change date' },
    repeatButton(
      '-10y',
      'Back 10 years',
      step((j) => addMonths(j, -120)),
    ),
    repeatButton(
      '-1y',
      'Back 1 year',
      step((j) => addMonths(j, -12)),
    ),
    repeatButton(
      '-1m',
      'Back 1 month',
      step((j) => addMonths(j, -1)),
    ),
    repeatButton(
      '-1d',
      'Back 1 day',
      step((j) => j - 1),
    ),
    readout,
    repeatButton(
      '+1d',
      'Forward 1 day',
      step((j) => j + 1),
    ),
    repeatButton(
      '+1m',
      'Forward 1 month',
      step((j) => addMonths(j, 1)),
    ),
    repeatButton(
      '+1y',
      'Forward 1 year',
      step((j) => addMonths(j, 12)),
    ),
    repeatButton(
      '+10y',
      'Forward 10 years',
      step((j) => addMonths(j, 120)),
    ),
    h(
      'button',
      { type: 'button', class: 'btn primary', onclick: () => setDate(todayJDN()) },
      'Today',
    ),
  );

  const root = h('section', { class: 'date-control', 'aria-label': 'Date' }, row, slider);

  const sync = () => {
    const j = getState().jdn;
    readout.textContent = describeGregorian(j);
    slider.value = String(Math.min(SCRUB_MAX, Math.max(SCRUB_MIN, j)));
  };
  subscribe(sync);
  sync();
  return root;
}
