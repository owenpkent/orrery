/** Today / Concordance: the chosen date in every calendar, plus the nearby sky. */
import { CALENDARS, FAMILY_LABEL, FAMILY_ORDER, type Calendar } from '../calendars';
import { MS_PER_DAY, UNIX_EPOCH_JDN } from '../calendars/jdn';
import {
  SEASON_KINDS,
  adjacentEvent,
  moonStateAt,
  type SkyEvent,
  type SkyKind,
} from '../sky/events';
import { getState, subscribe } from '../state';
import { describeGregorian } from '../ui/dateControl';
import { clear, h } from '../ui/dom';
import { setText } from '../ui/fx';
import { FAMILY_VAR, formatDateTimeUtc } from '../ui/format';

const NS = 'http://www.w3.org/2000/svg';

const MEDIUM = new Set([
  'hebrew',
  'islamic-umalqura',
  'chinese',
  'maya',
  'persian',
  'french-republican',
]);

function sizeOf(c: Calendar): 'xl' | 'lg' | 'md' | 'wide' | 'sm' {
  if (c.id === 'orrery') return 'xl';
  if (c.id === 'gregorian') return 'lg';
  if (MEDIUM.has(c.id)) return 'md';
  if (c.family === 'count') return 'wide';
  return 'sm';
}

function svg(tag: string, attrs: Record<string, string>): SVGElement {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

/** A rendered moon: dark disc, lit phase with soft limb shading, and a halo scaled to illumination. */
function createMoon(): { el: SVGSVGElement; set(angle: number, lit: number): void } {
  const r = 50;
  const el = svg('svg', {
    viewBox: '-64 -64 128 128',
    class: 'moon-svg',
    role: 'img',
    'aria-label': 'Moon phase',
  }) as SVGSVGElement;
  const defs = svg('defs', {});
  defs.innerHTML = `
    <radialGradient id="moon-lit" cx="38%" cy="34%" r="80%">
      <stop offset="0" stop-color="#fffaf0"/><stop offset=".55" stop-color="#e6e2d8"/><stop offset="1" stop-color="#a9a7a8"/>
    </radialGradient>
    <radialGradient id="moon-dark" cx="50%" cy="50%" r="60%">
      <stop offset="0" stop-color="#1a2038"/><stop offset="1" stop-color="#0b0f1f"/>
    </radialGradient>
    <radialGradient id="moon-halo" cx="50%" cy="50%" r="50%">
      <stop offset=".6" stop-color="#bcd0ff" stop-opacity=".5"/><stop offset="1" stop-color="#bcd0ff" stop-opacity="0"/>
    </radialGradient>
    <clipPath id="moon-clip"><circle r="${r}"/></clipPath>
    <clipPath id="moon-litclip"><path id="moon-litclip-path"/></clipPath>`;
  const halo = svg('circle', { r: '63', fill: 'url(#moon-halo)', class: 'moon-halo' });
  const dark = svg('circle', { r: String(r), fill: 'url(#moon-dark)' });
  const g = svg('g', { 'clip-path': 'url(#moon-clip)' });
  const lit = svg('path', { fill: 'url(#moon-lit)' });
  const craters = svg('g', { fill: '#6c6a70', opacity: '0.3', 'clip-path': 'url(#moon-litclip)' });
  for (const [x, y, cr] of [
    [-16, -14, 9],
    [14, 6, 12],
    [-8, 22, 6],
    [24, -22, 5],
    [-28, 8, 5],
    [4, -28, 4],
  ])
    craters.append(svg('circle', { cx: String(x), cy: String(y), r: String(cr) }));
  const ring = svg('circle', { r: String(r), fill: 'none', stroke: 'rgba(255,255,255,.18)' });
  const litWrap = svg('g', {});
  litWrap.append(lit, craters);
  g.append(litWrap);
  el.append(defs, halo, dark, g, ring);
  return {
    el,
    set(angle, frac) {
      const a = (angle * Math.PI) / 180;
      const rx = Math.abs(Math.cos(a)) * r;
      const crescent = Math.cos(a) > 0;
      const d = `M0 ${-r} A${r} ${r} 0 0 1 0 ${r} A${rx} ${r} 0 0 ${crescent ? 0 : 1} 0 ${-r} Z`;
      lit.setAttribute('d', d);
      defs.querySelector('#moon-litclip-path')?.setAttribute('d', d);
      litWrap.setAttribute('transform', angle < 180 ? '' : 'scale(-1 1)');
      halo.setAttribute('opacity', (0.15 + frac * 0.85).toFixed(2));
    },
  };
}

interface Cd {
  title: string;
  kinds: SkyKind[];
  tint: string;
  num: HTMLElement;
  unit: HTMLElement;
  what: HTMLElement;
  when: HTMLElement;
  el: HTMLElement;
}

function countdown(title: string, kinds: SkyKind[], tint: string): Cd {
  const num = h('span', { class: 'cd-num num' });
  const unit = h('span', { class: 'cd-unit' });
  const what = h('span', { class: 'cd-what' });
  const when = h('span', { class: 'cd-when num' });
  const el = h(
    'div',
    { class: 'cd', style: `--fam:${tint}` },
    h('span', { class: 'cd-title' }, title),
    h('div', { class: 'cd-big' }, num, unit),
    what,
    when,
  );
  return { title, kinds, tint, num, unit, what, when, el };
}

export function mountToday(root: HTMLElement): () => void {
  const title = h(
    'h1',
    { class: 'view-title', 'data-reveal': '' },
    'This day, in ',
    h('em', {}, 'every'),
    ' calendar.',
  );
  const sub = h('p', { class: 'view-intro mono-sub', 'data-reveal': '', 'data-i': '1' });

  // ---- sky panel ----
  const moon = createMoon();
  const moonName = h('div', { class: 'moon-name display' });
  const moonLit = h('div', { class: 'moon-lit-text num' });
  const cds = [
    countdown('Next solstice or equinox', [...SEASON_KINDS], 'var(--ev-season)'),
    countdown('Next full moon', ['full_moon'], 'var(--ev-moon)'),
    countdown('Next new moon', ['new_moon'], 'var(--ev-quarter)'),
    countdown('Next lunar eclipse', ['lunar_eclipse'], 'var(--ev-eclipse)'),
    countdown('Next solar eclipse', ['solar_eclipse'], 'var(--ev-eclipse)'),
    countdown('Next perihelion or aphelion', ['perihelion', 'aphelion'], 'var(--ev-apsis)'),
  ];
  const sky = h(
    'section',
    { class: 'panel glass sky', 'aria-labelledby': 'sky-h', 'data-reveal': '', 'data-i': '2' },
    h('h2', { id: 'sky-h', class: 'sr-only' }, 'The sky on this date'),
    h(
      'div',
      { class: 'moon-block' },
      h('div', { class: 'moon-wrap' }, moon.el),
      h('div', {}, h('span', { class: 'eyebrow' }, 'Moon at 12:00 UTC'), moonName, moonLit),
    ),
    h('div', { class: 'cd-grid' }, ...cds.map((c) => c.el)),
  );

  // ---- calendar cards ----
  const grid = h('div', { class: 'concord' });
  const cards = new Map<
    string,
    { cal: Calendar; label: HTMLElement; extra: HTMLElement; weekday: HTMLElement }
  >();
  const ordered = [...CALENDARS].sort(
    (a, b) =>
      ['xl', 'lg', 'md', 'wide', 'sm'].indexOf(sizeOf(a)) -
        ['xl', 'lg', 'md', 'wide', 'sm'].indexOf(sizeOf(b)) ||
      FAMILY_ORDER.indexOf(a.family) - FAMILY_ORDER.indexOf(b.family),
  );
  ordered.forEach((cal, i) => {
    const size = sizeOf(cal);
    const label = h('div', { class: 'card-label' });
    const extra = h('div', { class: 'card-extra num' });
    const weekday = h('div', { class: 'card-weekday' });
    cards.set(cal.id, { cal, label, extra, weekday });
    const info =
      size === 'xl' || size === 'lg'
        ? h('p', { class: 'blurb' }, cal.blurb)
        : h('details', {}, h('summary', {}, 'About'), h('p', { class: 'blurb' }, cal.blurb));
    grid.append(
      h(
        'article',
        {
          class: `card glass c-${size} fam-${cal.family}`,
          style: `--fam:${FAMILY_VAR[cal.family]}`,
          'data-reveal': '',
          'data-i': String(Math.min(i, 7)),
        },
        h(
          'div',
          { class: 'card-head' },
          h('span', { class: 'fam-tag' }, h('i'), FAMILY_LABEL[cal.family]),
          h('span', { class: 'card-region' }, cal.region),
        ),
        h('h3', { class: 'card-name' }, cal.name),
        label,
        extra,
        weekday,
        info,
      ),
    );
  });

  clear(root);
  root.append(title, sub, sky, grid);

  const render = () => {
    const { jdn } = getState();
    const noon = (jdn - UNIX_EPOCH_JDN) * MS_PER_DAY + MS_PER_DAY / 2;
    setText(sub, describeGregorian(jdn));

    const m = moonStateAt(noon);
    moon.set(m.angle, m.illuminated);
    setText(moonName, m.name);
    setText(moonLit, `${Math.round(m.illuminated * 100)}% illuminated`);

    for (const c of cds) {
      const ev: SkyEvent | undefined = adjacentEvent(noon, new Set(c.kinds), 1);
      if (!ev) {
        setText(c.num, '--');
        setText(c.unit, '');
        setText(c.what, 'none found');
        setText(c.when, '');
        continue;
      }
      const days = Math.round((ev.time - noon) / MS_PER_DAY);
      setText(c.num, String(days));
      setText(c.unit, days === 1 ? 'day' : 'days');
      setText(c.what, ev.label);
      setText(c.when, formatDateTimeUtc(ev.time));
    }

    for (const { cal, label, extra, weekday } of cards.values()) {
      const d = cal.fromJDN(jdn);
      setText(label, d.label);
      setText(extra, d.extra ?? '');
      extra.hidden = !d.extra;
      const showDay = !!d.weekday && !d.extra?.includes(d.weekday);
      setText(weekday, showDay ? (d.weekday ?? '') : '');
      weekday.hidden = !showDay;
    }
  };

  render();
  return subscribe(render);
}
