/** Orrery Calendar: the invented calendar's year as a grid of 13 months. */
import { ORRERY_CONFIG as CFG, REGULAR_DAYS } from '../calendars/orrery-config';
import {
  orreryDate,
  orreryMonthName,
  orreryShortMonthLength,
  orreryYearLength,
  orreryYearSolsticeMs,
  orreryYearStart,
  orreryYearStats,
} from '../calendars/orrery';
import { GREGORIAN_MONTHS, jdnToGregorian, todayJDN } from '../calendars/jdn';
import { getState, setDate, subscribe } from '../state';
import { describeGregorian } from '../ui/dateControl';
import { clear, h, repeatButton } from '../ui/dom';
import { setText } from '../ui/fx';
import { formatDateTimeUtc } from '../ui/format';

function shortGregorian(jdn: number): string {
  const g = jdnToGregorian(jdn);
  return `${g.day} ${GREGORIAN_MONTHS[g.month - 1].slice(0, 3)}`;
}

/** Tiny caption in each cell: the Gregorian day number, or the month name on the 1st. */
function gregorianCaption(jdn: number): string {
  const g = jdnToGregorian(jdn);
  return g.day === 1 ? GREGORIAN_MONTHS[g.month - 1].slice(0, 3) : String(g.day);
}

export function mountOrreryCalendar(root: HTMLElement): () => void {
  const detail = h('div', { class: 'panel glass orr-detail', 'aria-live': 'polite' });
  let hoverJdn: number | null = null;
  let lastYear = -1;

  const yearNum = h('strong', { class: 'orr-yearnum display' });
  const lenBadge = h('span', { class: 'len-badge num' });
  const facts = h('ul', { class: 'orr-facts' });
  const header = h(
    'section',
    { class: 'panel glass orr-header', 'data-reveal': '', 'data-i': '1' },
    h(
      'div',
      { class: 'orr-year-row' },
      repeatButton(
        '‹',
        'Previous Orrery year',
        () => setDate(orreryYearStart(orreryDate(getState().jdn).year - 1)),
        'btn round',
      ),
      h(
        'div',
        { class: 'orr-year' },
        h('span', { class: 'eyebrow' }, 'Orrery year'),
        h('div', { class: 'orr-year-line' }, yearNum, lenBadge),
      ),
      repeatButton(
        '›',
        'Next Orrery year',
        () => setDate(orreryYearStart(orreryDate(getState().jdn).year + 1)),
        'btn round',
      ),
      h('span', { class: 'orr-spacer' }),
      h(
        'button',
        { type: 'button', class: 'btn', onclick: () => setDate(todayJDN()) },
        'This year',
      ),
      h(
        'button',
        {
          type: 'button',
          class: 'btn',
          onclick: () => setDate(orreryYearStart(orreryDate(getState().jdn).year)),
        },
        'Go to New Year',
      ),
    ),
    facts,
  );
  const grid = h('div', { class: 'orr-grid' });
  const lengths = h('div', { class: 'orr-lengths' });

  function showDetail(jdn: number) {
    const d = orreryDate(jdn);
    clear(detail);
    const month = orreryMonthName(d.month);
    detail.append(
      h('div', { class: 'muted' }, hoverJdn === null ? 'Selected day' : 'Under the pointer'),
      h('div', { class: 'big' }, `${d.day} ${month} ${d.year}`),
      h(
        'div',
        {},
        d.isFestival
          ? `Year-end festival, day ${d.day} (${CFG.WEEKDAY_NAMES[d.weekdayNumber - 1]})`
          : `Week ${d.week}, ${CFG.WEEKDAY_NAMES[d.weekdayNumber - 1]}`,
        ' ',
        h(
          'span',
          { class: d.isWorkday ? 'tag work' : 'tag off' },
          d.isWorkday ? 'workday' : 'day off',
        ),
      ),
      h('div', { class: 'equals' }, `= ${describeGregorian(jdn)} (Gregorian)`),
      h('div', { class: 'muted' }, `Day ${d.dayOfYear + 1} of ${d.yearLength}`),
    );
  }

  function render() {
    const sel = getState().jdn;
    const today = todayJDN();
    const sd = orreryDate(sel);
    const year = sd.year;
    const start = orreryYearStart(year);
    const len = orreryYearLength(year);
    const stats = orreryYearStats(year);

    // Header (the stepper row is built once so hold-to-repeat survives re-renders)
    setText(yearNum, String(year));
    setText(lenBadge, `${len} days`);
    lenBadge.classList.toggle('long', len === 366);
    clear(facts);
    facts.append(
      h(
        'li',
        {},
        h('strong', {}, `${len} days`),
        len === 366 ? ' (a long year)' : ' (a common year)',
        `, so the ${CFG.FESTIVAL_NAME.toLowerCase()} month has ${orreryShortMonthLength(year)} days.`,
      ),
      h(
        'li',
        {},
        `Begins on the December solstice: ${formatDateTimeUtc(orreryYearSolsticeMs(year))}, which makes New Year's Day ${describeGregorian(start)}.`,
      ),
      h('li', {}, `${stats.workdays} workdays and ${stats.daysOff} days off.`),
    );
    const refocus = grid.contains(document.activeElement);

    // Grid
    clear(grid);
    for (let m = 1; m <= CFG.REGULAR_MONTHS + 1; m++) {
      const festival = m === CFG.REGULAR_MONTHS + 1;
      const days = festival ? len - REGULAR_DAYS : CFG.DAYS_PER_MONTH;
      const first = start + (m - 1) * CFG.DAYS_PER_MONTH;
      const cells = h('div', { class: `orr-days${festival ? ' festival' : ''}` });
      for (let d = 1; d <= days; d++) {
        const j = first + d - 1;
        const od = orreryDate(j);
        const cls = ['orr-day', od.isWorkday ? 'work' : 'off'];
        if (j === sel) cls.push('selected');
        if (j === today) cls.push('today');
        const label = `${d} ${orreryMonthName(m)}: ${od.isWorkday ? 'workday' : 'day off'}, ${describeGregorian(j)}`;
        const cell = h(
          'button',
          { type: 'button', class: cls.join(' '), 'aria-label': label, title: label },
          h('span', { class: 'n' }, String(d)),
          h('span', { class: 'g' }, gregorianCaption(j)),
        );
        cell.addEventListener('pointerenter', () => {
          hoverJdn = j;
          showDetail(j);
        });
        cell.addEventListener('focus', () => {
          hoverJdn = j;
          showDetail(j);
        });
        cell.addEventListener('pointerleave', () => {
          hoverJdn = null;
          showDetail(getState().jdn);
        });
        cell.addEventListener('click', () => setDate(j));
        cells.append(cell);
      }
      grid.append(
        h(
          'section',
          {
            class: `orr-month glass${festival ? ' festival' : ''}`,
            style: festival ? '--fam:var(--gold)' : '--fam:var(--c-invented)',
          },
          h(
            'h3',
            {},
            h('span', { class: 'mname' }, orreryMonthName(m)),
            festival ? h('span', { class: 'fest-tag' }, '✦ festival') : null,
            h(
              'span',
              { class: 'muted mrange num' },
              ` ${shortGregorian(first)} to ${shortGregorian(first + days - 1)}`,
            ),
          ),
          cells,
        ),
      );
    }

    // Year-length strip
    clear(lengths);
    lengths.append(
      h('h3', {}, 'Year lengths around this year'),
      h(
        'p',
        { class: 'muted' },
        'Leap years come from the sky, not a rule. Gold bars are 366-day years, blue are 365. Click a bar to jump to that year.',
      ),
    );
    const bars = h('div', { class: 'bars' });
    for (let y = year - 8; y <= year + 8; y++) {
      const l = orreryYearLength(y);
      const b = h(
        'button',
        {
          type: 'button',
          class: `bar${y === year ? ' current' : ''}${l === 366 ? ' long' : ''}`,
          'aria-label': `Year ${y}: ${l} days`,
          title: `Year ${y}: ${l} days, begins ${shortGregorian(orreryYearStart(y))} ${jdnToGregorian(orreryYearStart(y)).year}`,
          onclick: () => setDate(orreryYearStart(y)),
        },
        h('span', { class: 'bar-fill', style: `height:${(l - 360) * 8}px` }),
        h('span', { class: 'bar-len' }, l === 366 ? '366' : ''),
        h('span', { class: 'bar-year' }, (y - year) % 4 === 0 ? String(y) : ''),
      );
      bars.append(b);
    }
    lengths.append(bars);

    if (hoverJdn === null || lastYear !== year) {
      hoverJdn = null;
      showDetail(sel);
    }
    lastYear = year;
    if (refocus) grid.querySelector<HTMLElement>('.orr-day.selected')?.focus();
  }

  clear(root);
  root.append(
    h(
      'div',
      { class: 'orrery-cal-view' },
      h(
        'h1',
        { class: 'view-title', 'data-reveal': '' },
        'The ',
        h('em', {}, 'Orrery'),
        ' calendar.',
      ),
      h(
        'p',
        { class: 'view-intro', 'data-reveal': '', 'data-i': '1' },
        '12 months of 30 days in locked 10-day weeks, then a short festival month. Softly lit tiles are workdays (days 1 to 6 of each week); the quiet, cool tiles are days off.',
      ),
      header,
      h('div', { class: 'orr-main' }, grid, h('aside', { class: 'orr-side' }, detail, lengths)),
    ),
  );
  render();
  return subscribe(render);
}
