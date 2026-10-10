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
import { setText } from './fx';

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
  const btn = (label: string, aria: string, fn: (j: number) => number, cls = '') =>
    repeatButton(label, aria, step(fn), `step ${cls}`.trim());

  const weekday = h('span', { class: 'dc-weekday' });
  const date = h('span', { class: 'dc-date' });
  const readout = h(
    'output',
    { class: 'dc-readout', 'aria-live': 'polite', 'aria-atomic': 'true' },
    weekday,
    date,
  );
  const slider = h('input', {
    type: 'range',
    class: 'scrub',
    min: String(SCRUB_MIN),
    max: String(SCRUB_MAX),
    step: '1',
    'aria-label': 'Scrub through dates, 1900 to 2100',
  });
  slider.addEventListener('input', () => setDate(Number(slider.value)));

  const left = h(
    'div',
    { class: 'dc-steps', role: 'group', 'aria-label': 'Step back' },
    btn('-10y', 'Back 10 years', (j) => addMonths(j, -120), 'far'),
    btn('-1y', 'Back 1 year', (j) => addMonths(j, -12)),
    btn('-1m', 'Back 1 month', (j) => addMonths(j, -1)),
    btn('-1d', 'Back 1 day', (j) => j - 1, 'day'),
  );
  const right = h(
    'div',
    { class: 'dc-steps', role: 'group', 'aria-label': 'Step forward' },
    btn('+1d', 'Forward 1 day', (j) => j + 1, 'day'),
    btn('+1m', 'Forward 1 month', (j) => addMonths(j, 1)),
    btn('+1y', 'Forward 1 year', (j) => addMonths(j, 12)),
    btn('+10y', 'Forward 10 years', (j) => addMonths(j, 120), 'far'),
  );

  const more = h(
    'button',
    {
      type: 'button',
      class: 'btn dc-more',
      'aria-expanded': 'false',
      'aria-label': 'Show date steppers',
      onclick: () => {
        const open = root.classList.toggle('open');
        more.setAttribute('aria-expanded', String(open));
        more.textContent = open ? 'Less' : 'Step';
      },
    },
    'Step',
  );

  const root = h(
    'section',
    { class: 'date-control glass', 'aria-label': 'Date' },
    h(
      'div',
      { class: 'dc-row' },
      left,
      readout,
      right,
      more,
      h(
        'button',
        { type: 'button', class: 'btn primary dc-today', onclick: () => setDate(todayJDN()) },
        'Today',
      ),
    ),
    h(
      'div',
      { class: 'dc-scrub' },
      h('span', { class: 'dc-end', 'aria-hidden': 'true' }, '1900'),
      slider,
      h('span', { class: 'dc-end', 'aria-hidden': 'true' }, '2100'),
    ),
  );

  const sync = () => {
    const j = getState().jdn;
    const g = jdnToGregorian(j);
    setText(weekday, WEEKDAYS[weekdayIndex(j)]);
    setText(
      date,
      `${String(g.day).padStart(2, '0')} ${GREGORIAN_MONTHS[g.month - 1].slice(0, 3)} ${g.year}`,
    );
    const v = Math.min(SCRUB_MAX, Math.max(SCRUB_MIN, j));
    slider.value = String(v);
    slider.style.setProperty('--p', `${((v - SCRUB_MIN) / (SCRUB_MAX - SCRUB_MIN)) * 100}%`);
  };
  subscribe(sync);
  sync();
  return root;
}
