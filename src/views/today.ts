/** Today / Concordance: the chosen date in every calendar, plus the nearby sky. */
import { CALENDARS, FAMILY_LABEL, FAMILY_ORDER } from '../calendars';
import { MS_PER_DAY, UNIX_EPOCH_JDN } from '../calendars/jdn';
import {
  KIND_LABEL,
  SEASON_KINDS,
  adjacentEvent,
  moonStateAt,
  type SkyEvent,
  type SkyKind,
} from '../sky/events';
import { getState, subscribe } from '../state';
import { clear, h } from '../ui/dom';
import { FAMILY_VAR, formatDateTimeUtc, relativeDays } from '../ui/format';

const NS = 'http://www.w3.org/2000/svg';

/** Draw the moon disc for a phase angle (0 new, 180 full). */
function moonSvg(angle: number): SVGSVGElement {
  const r = 22;
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '-26 -26 52 52');
  svg.setAttribute('width', '64');
  svg.setAttribute('height', '64');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Moon phase');
  const dark = document.createElementNS(NS, 'circle');
  dark.setAttribute('r', String(r));
  dark.setAttribute('class', 'moon-dark');
  svg.append(dark);
  const waxing = angle < 180;
  const a = (angle * Math.PI) / 180;
  const rx = Math.abs(Math.cos(a)) * r;
  const crescent = Math.cos(a) > 0;
  const sweep = crescent ? 0 : 1;
  const lit = document.createElementNS(NS, 'path');
  lit.setAttribute('d', `M0 ${-r} A${r} ${r} 0 0 1 0 ${r} A${rx} ${r} 0 0 ${sweep} 0 ${-r} Z`);
  lit.setAttribute('class', 'moon-lit');
  if (!waxing) lit.setAttribute('transform', 'scale(-1 1)');
  svg.append(lit);
  const ring = document.createElementNS(NS, 'circle');
  ring.setAttribute('r', String(r));
  ring.setAttribute('class', 'moon-ring');
  svg.append(ring);
  return svg;
}

function eventRow(label: string, ev: SkyEvent | undefined, jdn: number): HTMLElement {
  return h(
    'li',
    {},
    h('span', { class: 'ev-label' }, label),
    ev
      ? h(
          'span',
          { class: 'ev-value' },
          h('strong', {}, ev.label),
          h(
            'span',
            { class: 'muted' },
            ` ${formatDateTimeUtc(ev.time)} (${relativeDays(ev.time, jdn)})`,
          ),
        )
      : h('span', { class: 'muted' }, 'none found'),
  );
}

export function mountToday(root: HTMLElement): () => void {
  const render = () => {
    const { jdn } = getState();
    const noon = (jdn - UNIX_EPOCH_JDN) * MS_PER_DAY + MS_PER_DAY / 2;
    clear(root);

    // Sky panel
    const moon = moonStateAt(noon);
    const seasons = new Set<SkyKind>(SEASON_KINDS);
    const prevSeason = adjacentEvent(noon, seasons, -1);
    const nextSeason = adjacentEvent(noon, seasons, 1);
    const nextLunar = adjacentEvent(noon, new Set<SkyKind>(['lunar_eclipse']), 1);
    const nextSolar = adjacentEvent(noon, new Set<SkyKind>(['solar_eclipse']), 1);
    const nextFull = adjacentEvent(noon, new Set<SkyKind>(['full_moon']), 1);
    const nextNew = adjacentEvent(noon, new Set<SkyKind>(['new_moon']), 1);
    const apsis = adjacentEvent(noon, new Set<SkyKind>(['perihelion', 'aphelion']), 1);

    const sky = h(
      'section',
      { class: 'panel sky', 'aria-labelledby': 'sky-h' },
      h('h2', { id: 'sky-h' }, 'The sky on this date'),
      h(
        'div',
        { class: 'moon-row' },
        moonSvg(moon.angle),
        h(
          'div',
          {},
          h('div', { class: 'big' }, moon.name),
          h(
            'div',
            { class: 'muted' },
            `${Math.round(moon.illuminated * 100)}% illuminated (at 12:00 UTC)`,
          ),
        ),
      ),
      h(
        'ul',
        { class: 'events' },
        eventRow('Previous solstice or equinox', prevSeason, jdn),
        eventRow('Next solstice or equinox', nextSeason, jdn),
        eventRow('Next new moon', nextNew, jdn),
        eventRow('Next full moon', nextFull, jdn),
        eventRow('Next lunar eclipse', nextLunar, jdn),
        eventRow('Next solar eclipse', nextSolar, jdn),
        eventRow(`Next ${apsis ? KIND_LABEL[apsis.kind].toLowerCase() : 'apsis'}`, apsis, jdn),
      ),
    );

    // Calendar cards by family
    const groups = h('div', { class: 'groups' });
    for (const fam of FAMILY_ORDER) {
      const cals = CALENDARS.filter((c) => c.family === fam);
      if (!cals.length) continue;
      const grid = h('div', { class: 'cards' });
      for (const cal of cals) {
        const d = cal.fromJDN(jdn);
        grid.append(
          h(
            'article',
            { class: `card fam-${fam}`, style: `--fam:${FAMILY_VAR[fam]}` },
            h('h4', {}, cal.name),
            h('div', { class: 'card-label' }, d.label),
            d.extra ? h('div', { class: 'card-extra' }, d.extra) : null,
            d.weekday && !d.extra?.includes(d.weekday)
              ? h('div', { class: 'muted' }, d.weekday)
              : null,
            h('details', {}, h('summary', {}, cal.region), h('p', { class: 'blurb' }, cal.blurb)),
          ),
        );
      }
      groups.append(
        h(
          'section',
          { class: 'group', style: `--fam:${FAMILY_VAR[fam]}` },
          h('h3', {}, h('span', { class: 'swatch' }), FAMILY_LABEL[fam]),
          grid,
        ),
      );
    }

    root.append(h('div', { class: 'today-layout' }, sky, groups));
  };

  render();
  return subscribe(render);
}
