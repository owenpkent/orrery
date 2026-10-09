/** Timeline: one swimlane per calendar, month bands across a pannable, zoomable window. */
import { CALENDARS, FAMILY_ORDER } from '../calendars';
import type { Calendar } from '../calendars';
import { gregorianToJDN, jdnToGregorian, GREGORIAN_MONTHS } from '../calendars/jdn';
import { KIND_LABEL, eventsInRange, type SkyEvent, type SkyKind } from '../sky/events';
import { getState, setDate, subscribe } from '../state';
import { describeGregorian } from '../ui/dateControl';
import { clear, esc, h } from '../ui/dom';
import { reducedMotion, tween } from '../ui/fx';
import { FAMILY_VAR, formatDateTimeUtc } from '../ui/format';

const MIN_SPAN = 14;
const MAX_SPAN = 9200;
const LANE_H = 34;
const AXIS_H = 44;
const STRIP_H = 36;
const MS_PER_DAY = 86400000;

/** t coordinates: civil day j spans [j, j + 1). Event instants map to ms / day + 2440588. */
const tOfMs = (ms: number) => ms / MS_PER_DAY + 2440588;

interface EventGroup {
  id: string;
  label: string;
  kinds: SkyKind[];
  cls: string;
  defaultOn: boolean;
  maxSpan: number;
}

const EVENT_GROUPS: EventGroup[] = [
  {
    id: 'seasons',
    label: 'Solstices and equinoxes',
    kinds: ['march_equinox', 'june_solstice', 'september_equinox', 'december_solstice'],
    cls: 'ev-season',
    defaultOn: true,
    maxSpan: 1e9,
  },
  {
    id: 'newfull',
    label: 'New and full moons',
    kinds: ['new_moon', 'full_moon'],
    cls: 'ev-moon',
    defaultOn: true,
    maxSpan: 1100,
  },
  {
    id: 'quarters',
    label: 'Quarter moons',
    kinds: ['first_quarter', 'last_quarter'],
    cls: 'ev-quarter',
    defaultOn: false,
    maxSpan: 400,
  },
  {
    id: 'eclipses',
    label: 'Eclipses',
    kinds: ['lunar_eclipse', 'solar_eclipse'],
    cls: 'ev-eclipse',
    defaultOn: true,
    maxSpan: 1e9,
  },
  {
    id: 'apsides',
    label: 'Perihelion and aphelion',
    kinds: ['perihelion', 'aphelion'],
    cls: 'ev-apsis',
    defaultOn: false,
    maxSpan: 1e9,
  },
];

function lanesInOrder(): Calendar[] {
  const first = ['gregorian', 'orrery'];
  const rest = CALENDARS.filter((c) => !first.includes(c.id));
  rest.sort((a, b) => FAMILY_ORDER.indexOf(a.family) - FAMILY_ORDER.indexOf(b.family));
  return [...first.map((id) => CALENDARS.find((c) => c.id === id)!), ...rest];
}

export function mountTimeline(root: HTMLElement): () => void {
  const lanesAll = lanesInOrder();
  const hiddenLanes = new Set<string>([
    'julian',
    'islamic-civil',
    'dangi',
    'roc',
    'holocene',
    'unix',
  ]);
  const eventOn = new Set(EVENT_GROUPS.filter((g) => g.defaultOn).map((g) => g.id));

  // Window in t coordinates: [start, start + span).
  const initYear = jdnToGregorian(getState().jdn).year;
  let start = gregorianToJDN(initYear, 1, 1);
  let span = 366;
  let width = 1000;
  let hoverT: number | null = null;
  let hoverLane = -1;

  const svgHost = h('div', { class: 'tl-host' });
  const tip = h('div', { class: 'tl-tip', role: 'status', hidden: true });
  const hint = h('p', { class: 'muted tl-hint' });
  const rangeLabel = h('output', { class: 'tl-range', 'aria-live': 'polite' });

  const lanes = () => lanesAll.filter((c) => !hiddenLanes.has(c.id));
  const labelW = () => (width < 640 ? 96 : 176);

  let stopAnim: (() => void) | null = null;

  /** Glide the window to a new start and span (instant under reduced motion or while dragging). */
  function glide(ns: number, nsp: number, animate = true) {
    stopAnim?.();
    stopAnim = null;
    const s0 = start;
    const sp0 = span;
    if (!animate || reducedMotion()) {
      start = ns;
      span = nsp;
      draw();
      return;
    }
    // interpolate the span in log space so zooming feels even
    stopAnim = tween(0, 1, 520, (p) => {
      span = Math.exp(Math.log(sp0) + (Math.log(nsp) - Math.log(sp0)) * p);
      start = s0 + (ns - s0) * p;
      draw();
    });
  }

  function zoom(factor: number, anchorT?: number, animate = true) {
    const a = anchorT ?? start + span / 2;
    const ns = Math.min(MAX_SPAN, Math.max(MIN_SPAN, span * factor));
    const frac = (a - start) / span;
    glide(a - frac * ns, ns, animate);
  }

  function pan(days: number, animate = true) {
    glide(start + days, span, animate);
  }

  function setWindow(s: number, sp: number) {
    glide(s, sp);
  }

  function centerOnSelected(sp = span) {
    glide(getState().jdn + 0.5 - sp / 2, sp);
  }

  function draw() {
    const L = labelW();
    const plotW = Math.max(200, width - L - 8);
    const x = (t: number) => L + ((t - start) / span) * plotW;
    const ls = lanes();
    const height = AXIS_H + STRIP_H + ls.length * LANE_H + 6;
    const from = Math.floor(start) - 1;
    const to = Math.ceil(start + span) + 1;
    const parts: string[] = [];
    parts.push(
      `<svg xmlns="http://www.w3.org/2000/svg" class="tl-svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Calendar timeline">`,
    );
    parts.push(
      '<defs>' +
        Object.keys(FAMILY_VAR)
          .map(
            (f) =>
              `<linearGradient id="tg-${f}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" style="stop-color:${FAMILY_VAR[f]};stop-opacity:.62"/><stop offset="1" style="stop-color:${FAMILY_VAR[f]};stop-opacity:.24"/></linearGradient>` +
              `<linearGradient id="tg2-${f}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" style="stop-color:${FAMILY_VAR[f]};stop-opacity:.34"/><stop offset="1" style="stop-color:${FAMILY_VAR[f]};stop-opacity:.1"/></linearGradient>`,
          )
          .join('') +
        '</defs>',
    );

    // Axis: Gregorian months/years, and day numbers when zoomed in.
    const gcal = CALENDARS[0];
    const gSpans = gcal.monthStarts(from, to);
    for (const s of gSpans) {
      const xx = x(s.start);
      if (xx < L - 1 || xx > width) continue;
      const g = jdnToGregorian(s.start);
      parts.push(
        `<line class="axis-tick" x1="${xx}" x2="${xx}" y1="${AXIS_H - 12}" y2="${AXIS_H}"/>`,
      );
      if (span < 9000) {
        const text = g.month === 1 ? String(g.year) : GREGORIAN_MONTHS[g.month - 1].slice(0, 3);
        const w = x(s.end) - xx;
        if (w > 28 || g.month === 1) {
          parts.push(
            `<text class="axis-text${g.month === 1 ? ' axis-year' : ''}" x="${xx + 3}" y="${AXIS_H - 16}">${text}</text>`,
          );
        }
      }
    }
    if (span <= 62) {
      for (let j = from; j <= to; j++) {
        const xx = x(j);
        if (xx < L || xx > width) continue;
        const day = jdnToGregorian(j).day;
        parts.push(
          `<line class="axis-tick faint" x1="${xx}" x2="${xx}" y1="${AXIS_H - 6}" y2="${AXIS_H}"/>`,
        );
        if (plotW / span > 16) {
          parts.push(
            `<text class="axis-day" x="${xx + (x(j + 1) - xx) / 2}" y="${AXIS_H - 8}" text-anchor="middle">${day}</text>`,
          );
        }
      }
    }

    // Event strip markers
    const eventsShown: { ev: SkyEvent; cls: string }[] = [];
    for (const g of EVENT_GROUPS) {
      if (!eventOn.has(g.id) || span > g.maxSpan) continue;
      const kinds = new Set<SkyKind>(g.kinds);
      for (const ev of eventsInRange(
        (start - 2 - 2440588) * MS_PER_DAY,
        (start + span + 2 - 2440588) * MS_PER_DAY,
        kinds,
      )) {
        eventsShown.push({ ev, cls: g.cls });
      }
    }

    const laneTop = AXIS_H + STRIP_H;
    // Lanes
    ls.forEach((cal, i) => {
      const y = laneTop + i * LANE_H;
      const fam = FAMILY_VAR[cal.family];
      const bands = cal.monthStarts(from, to);
      parts.push(`<g class="lane fam-${cal.family}" style="--fam:${fam}">`);
      parts.push(
        `<rect class="lane-bg" x="${L}" y="${y}" width="${plotW}" height="${LANE_H - 2}"/>`,
      );
      let prevYear: number | null = null;
      bands.forEach((b, bi) => {
        const x0 = Math.max(L, x(b.start));
        const x1 = Math.min(L + plotW, x(b.end));
        const yearStart = prevYear !== null && b.year !== prevYear;
        prevYear = b.year;
        if (x1 <= x0) return;
        const w = x1 - x0;
        parts.push(
          `<rect class="band ${(bi + b.month) % 2 ? 'odd' : 'even'}${yearStart ? ' year-start' : ''}" x="${x0 + 1}" y="${y + 2}" width="${Math.max(1, w - 2)}" height="${LANE_H - 6}" rx="8" fill="url(#${(bi + b.month) % 2 ? 'tg' : 'tg2'}-${cal.family})"/>`,
        );
        if (yearStart && x(b.start) >= L) {
          parts.push(
            `<line class="year-line" x1="${x(b.start)}" x2="${x(b.start)}" y1="${y}" y2="${y + LANE_H - 2}"/>`,
          );
        }
        const fullW = x(b.end) - x(b.start);
        const label = b.label;
        const maxChars = Math.floor((w - 8) / 6.4);
        const t = fit(label, maxChars);
        if (t && fullW > 18) {
          const tx = Math.max(x0, x(b.start)) + 4;
          parts.push(
            `<text class="band-text" x="${tx}" y="${y + LANE_H / 2 + 3}">${esc(t)}</text>`,
          );
        }
      });
      parts.push('</g>');
      const nameChars = Math.floor((L - 24) / 6.6);
      const nm = cal.name.length > nameChars ? cal.name.slice(0, nameChars - 1) + '.' : cal.name;
      parts.push(
        `<g class="lane-name" style="--fam:${fam}"><circle cx="8" cy="${y + LANE_H / 2 - 1}" r="3.5"/><text x="19" y="${y + LANE_H / 2 + 3}">${esc(nm)}</text></g>`,
      );
    });

    const bottom = laneTop + ls.length * LANE_H;
    // Event lines and markers
    for (const { ev, cls } of eventsShown) {
      const xx = x(tOfMs(ev.time));
      if (xx < L || xx > L + plotW) continue;
      parts.push(
        `<line class="ev-glow ${cls}" x1="${xx}" x2="${xx}" y1="${AXIS_H}" y2="${bottom}"/>`,
        `<line class="ev-line ${cls}" x1="${xx}" x2="${xx}" y1="${AXIS_H}" y2="${bottom}"/>`,
      );
      const rowY = AXIS_H + (cls === 'ev-moon' || cls === 'ev-quarter' ? 26 : 10);
      const tt = `${ev.label}: ${formatDateTimeUtc(ev.time)}${ev.detail ? ` (${ev.detail})` : ''}`;
      parts.push(
        `<g class="ev-mark ${cls} k-${ev.kind}"><title>${esc(tt)}</title>${markerShape(ev.kind, xx, rowY)}</g>`,
      );
      if (cls === 'ev-season' && plotW / span > 0.9) {
        parts.push(
          `<text class="ev-text" x="${xx + 7}" y="${rowY + 4}">${esc(KIND_LABEL[ev.kind])}</text>`,
        );
      }
    }

    // Selected date
    const sel = getState().jdn;
    const sx0 = x(sel);
    const sx1 = x(sel + 1);
    if (sx1 >= L && sx0 <= L + plotW) {
      parts.push(
        `<rect class="sel-day" x="${Math.max(L, sx0)}" y="${AXIS_H}" width="${Math.max(2, sx1 - sx0)}" height="${bottom - AXIS_H}"/>`,
      );
    }

    // Hover crosshair
    if (hoverT !== null) {
      const hx = x(hoverT);
      if (hx >= L && hx <= L + plotW) {
        parts.push(
          `<line class="hover-line" x1="${hx}" x2="${hx}" y1="${AXIS_H}" y2="${bottom}"/>`,
        );
        if (hoverLane >= 0 && hoverLane < ls.length) {
          parts.push(
            `<rect class="hover-lane" x="${L}" y="${laneTop + hoverLane * LANE_H}" width="${plotW}" height="${LANE_H - 2}"/>`,
          );
        }
      }
    }
    parts.push('</svg>');
    svgHost.innerHTML = parts.join('');

    const a = jdnToGregorian(Math.floor(start));
    const b = jdnToGregorian(Math.floor(start + span - 1));
    rangeLabel.textContent = `${a.day} ${GREGORIAN_MONTHS[a.month - 1].slice(0, 3)} ${a.year} to ${b.day} ${GREGORIAN_MONTHS[b.month - 1].slice(0, 3)} ${b.year} (${Math.round(span)} days)`;
    const hidden: string[] = [];
    for (const g of EVENT_GROUPS)
      if (eventOn.has(g.id) && span > g.maxSpan) hidden.push(g.label.toLowerCase());
    hint.textContent = hidden.length ? `Zoom in to see: ${hidden.join(', ')}.` : '';
  }

  function geom() {
    const L = labelW();
    const plotW = Math.max(200, width - L - 8);
    return { L, plotW };
  }

  function pointerT(e: PointerEvent | WheelEvent): { t: number; lane: number; inPlot: boolean } {
    const r = svgHost.getBoundingClientRect();
    const { L, plotW } = geom();
    const px = e.clientX - r.left;
    const py = e.clientY - r.top;
    const t = start + ((px - L) / plotW) * span;
    const lane = Math.floor((py - (AXIS_H + STRIP_H)) / LANE_H);
    return { t, lane, inPlot: px >= L && px <= L + plotW };
  }

  // Drag to pan, click to select.
  let drag: { x: number; start: number; moved: boolean; id: number } | null = null;
  svgHost.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    stopAnim?.();
    stopAnim = null;
    drag = { x: e.clientX, start, moved: false, id: e.pointerId };
    svgHost.setPointerCapture(e.pointerId);
  });
  svgHost.addEventListener('pointermove', (e) => {
    if (drag) {
      const dx = e.clientX - drag.x;
      if (Math.abs(dx) > 3) drag.moved = true;
      if (drag.moved) {
        start = drag.start - (dx / geom().plotW) * span;
        tip.hidden = true;
        draw();
        return;
      }
    }
    const p = pointerT(e);
    const ls = lanes();
    if (!p.inPlot || p.lane < -1 || p.lane >= ls.length) {
      hoverT = null;
      hoverLane = -1;
      tip.hidden = true;
      draw();
      return;
    }
    hoverT = p.t;
    hoverLane = p.lane;
    const jdn = Math.floor(p.t);
    const lines: string[] = [];
    if (p.lane >= 0) {
      const cal = ls[p.lane];
      const d = cal.fromJDN(jdn);
      lines.push(`<strong>${esc(cal.name)}</strong>`, esc(d.label));
      if (d.extra) lines.push(`<span class="muted">${esc(d.extra)}</span>`);
    }
    lines.push(`<span class="muted">${esc(describeGregorian(jdn))}</span>`);
    tip.innerHTML = lines.join('<br>');
    tip.hidden = false;
    const hostRect = svgHost.getBoundingClientRect();
    const tx = Math.min(e.clientX - hostRect.left + 14, hostRect.width - 230);
    tip.style.left = `${Math.max(4, tx)}px`;
    tip.style.top = `${e.clientY - hostRect.top + 18}px`;
    draw();
  });
  svgHost.addEventListener('pointerup', (e) => {
    const d = drag;
    drag = null;
    if (svgHost.hasPointerCapture(e.pointerId)) svgHost.releasePointerCapture(e.pointerId);
    if (d && !d.moved) {
      const p = pointerT(e);
      if (p.inPlot) setDate(Math.floor(p.t));
    }
  });
  svgHost.addEventListener('pointerleave', () => {
    if (drag) return;
    hoverT = null;
    hoverLane = -1;
    tip.hidden = true;
    draw();
  });
  svgHost.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      const p = pointerT(e);
      if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        pan(((e.deltaX || e.deltaY) / geom().plotW) * span, false);
      } else {
        zoom(e.deltaY > 0 ? 1.18 : 1 / 1.18, p.inPlot ? p.t : undefined, false);
      }
    },
    { passive: false },
  );

  // Controls
  const btn = (label: string, aria: string, fn: () => void) =>
    h(
      'button',
      { type: 'button', class: 'btn', 'aria-label': aria, title: aria, onclick: fn },
      label,
    );
  const controls = h(
    'div',
    { class: 'tl-controls glass', role: 'group', 'aria-label': 'Timeline window' },
    btn('<', 'Pan earlier', () => pan(-span / 4)),
    btn('>', 'Pan later', () => pan(span / 4)),
    btn('+', 'Zoom in', () => zoom(1 / 1.5)),
    btn('-', 'Zoom out', () => zoom(1.5)),
    btn('Month', 'Show 45 days around the selected date', () => {
      centerOnSelected(45);
    }),
    btn('Year', 'Show one year around the selected date', () => {
      centerOnSelected(366);
    }),
    btn('10 years', 'Show ten years around the selected date', () => {
      centerOnSelected(3653);
    }),
    btn('Center on date', 'Center the window on the selected date', () => centerOnSelected()),
    btn('Gregorian year', 'Show the whole Gregorian year of the selected date', () => {
      const y = jdnToGregorian(getState().jdn).year;
      setWindow(gregorianToJDN(y, 1, 1), 365.25);
    }),
    rangeLabel,
  );

  // Toggles
  const toggles = h('div', { class: 'tl-toggles' });
  const evBox = h('fieldset', { class: 'toggle-group' }, h('legend', {}, 'Sky events'));
  for (const g of EVENT_GROUPS) {
    const cb = h('input', { type: 'checkbox', checked: eventOn.has(g.id) });
    cb.addEventListener('change', () => {
      if (cb.checked) eventOn.add(g.id);
      else eventOn.delete(g.id);
      draw();
    });
    evBox.append(h('label', { class: `chk ${g.cls}` }, cb, h('span', { class: 'key' }), g.label));
  }
  const laneBox = h(
    'details',
    { class: 'toggle-group lanes-box' },
    h('summary', {}, 'Calendars shown'),
  );
  const laneInner = h('div', { class: 'lane-checks' });
  for (const c of lanesAll) {
    const cb = h('input', { type: 'checkbox', checked: !hiddenLanes.has(c.id) });
    cb.addEventListener('change', () => {
      if (cb.checked) hiddenLanes.delete(c.id);
      else hiddenLanes.add(c.id);
      draw();
    });
    laneInner.append(
      h(
        'label',
        { class: 'chk', style: `--fam:${FAMILY_VAR[c.family]}` },
        cb,
        h('span', { class: 'key fam' }),
        c.name,
      ),
    );
  }
  laneBox.append(laneInner);
  toggles.append(evBox, laneBox);

  clear(root);
  root.append(
    h(
      'div',
      { class: 'timeline-view' },
      h(
        'h1',
        { class: 'view-title', 'data-reveal': '' },
        'Every calendar, ',
        h('em', {}, 'in parallel.'),
      ),
      h(
        'p',
        { class: 'view-intro', 'data-reveal': '', 'data-i': '1' },
        'Each lane is a calendar. Drag to pan, scroll to zoom, click to pick a day. Heavy lines mark where a calendar starts a new year.',
      ),
      controls,
      h('div', { class: 'tl-wrap' }, svgHost, tip),
      hint,
      toggles,
    ),
  );

  const measure = () => {
    width = Math.max(320, Math.floor(svgHost.clientWidth));
    draw();
  };
  const ro = new ResizeObserver(measure);
  ro.observe(svgHost);
  measure();

  const unsub = subscribe((st) => {
    if (st.jdn + 1 < start || st.jdn > start + span) centerOnSelected();
    else draw();
  });
  return () => {
    ro.disconnect();
    unsub();
  };
}

/** Fit a label into a number of characters: whole, abbreviated with a dot, or dropped. */
export function fit(label: string, maxChars: number): string {
  if (label.length <= maxChars) return label;
  return maxChars >= 4 ? label.slice(0, maxChars - 1) + '.' : '';
}

function markerShape(kind: SkyKind, cx: number, cy: number): string {
  switch (kind) {
    case 'new_moon':
      return `<circle cx="${cx}" cy="${cy}" r="5" class="m-fill"/>`;
    case 'full_moon':
      return `<circle cx="${cx}" cy="${cy}" r="5" class="m-hollow"/>`;
    case 'first_quarter':
    case 'last_quarter':
      return `<path d="M${cx} ${cy - 4} A4 4 0 0 ${kind === 'first_quarter' ? 1 : 0} ${cx} ${cy + 4} Z" class="m-fill"/>`;
    case 'lunar_eclipse':
      return `<path d="M${cx - 6} ${cy + 5} L${cx} ${cy - 6} L${cx + 6} ${cy + 5} Z" class="m-hollow"/>`;
    case 'solar_eclipse':
      return `<path d="M${cx - 6} ${cy + 5} L${cx} ${cy - 6} L${cx + 6} ${cy + 5} Z" class="m-fill"/>`;
    case 'perihelion':
    case 'aphelion':
      return `<rect x="${cx - 3.5}" y="${cy - 3.5}" width="7" height="7" class="${kind === 'perihelion' ? 'm-fill' : 'm-hollow'}"/>`;
    default:
      return `<path d="M${cx} ${cy - 7} L${cx + 6} ${cy} L${cx} ${cy + 7} L${cx - 6} ${cy} Z" class="m-fill"/>`;
  }
}
