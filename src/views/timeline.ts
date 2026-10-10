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

interface MarkPt {
  x: number;
  y: number;
  html: string;
}
/** Per-lane tints so neighbouring lanes of one family stay distinguishable. */
const LANE_TINTS = ['X', 'color-mix(in srgb, X 62%, white)', 'color-mix(in srgb, X 70%, #3a2a8a)'];

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
  const phone = window.innerWidth < 640;
  let span = phone ? 49 : 366;
  let start = phone ? getState().jdn + 0.5 - span / 2 : gregorianToJDN(initYear, 1, 1);
  let width = 1000;
  let hoverT: number | null = null;
  let hoverLane = -1;

  const svgHost = h('div', { class: 'tl-host' });
  const tip = h('div', { class: 'tl-tip', role: 'status', hidden: true });
  /** Event glyph positions from the last draw, so a tap can hit-test them (a finger is bigger than a glyph). */
  let markPts: MarkPt[] = [];
  const hint = h('p', { class: 'muted tl-hint' });
  const rangeLabel = h('output', { class: 'tl-range', 'aria-live': 'polite' });

  const lanes = () => lanesAll.filter((c) => !hiddenLanes.has(c.id));
  const narrow = () => width < 640;
  const labelW = () => (narrow() ? 8 : 176);
  const laneH = () => (narrow() ? 52 : LANE_H);
  const barOff = () => (narrow() ? 18 : 2);

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
    const height = AXIS_H + STRIP_H + ls.length * laneH() + 6;
    const from = Math.floor(start) - 1;
    const to = Math.ceil(start + span) + 1;
    const parts: string[] = [];
    parts.push(
      `<svg xmlns="http://www.w3.org/2000/svg" class="tl-svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Calendar timeline">`,
    );
    parts.push(
      '<defs>' +
        Object.keys(FAMILY_VAR)
          .flatMap((f) =>
            LANE_TINTS.map((mix, v) => {
              const c = mix.replace('X', FAMILY_VAR[f]);
              return (
                `<linearGradient id="tg${v}-${f}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" style="stop-color:${c};stop-opacity:.64"/><stop offset="1" style="stop-color:${c};stop-opacity:.26"/></linearGradient>` +
                `<linearGradient id="tg2${v}-${f}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" style="stop-color:${c};stop-opacity:.36"/><stop offset="1" style="stop-color:${c};stop-opacity:.12"/></linearGradient>`
              );
            }),
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
    markPts = [];
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
      const y = laneTop + i * laneH();
      const fam = FAMILY_VAR[cal.family];
      const bands = cal.monthStarts(from, to);
      parts.push(`<g class="lane fam-${cal.family}" style="--fam:${fam}">`);
      parts.push(
        `<rect class="lane-bg" x="${L}" y="${y}" width="${plotW}" height="${laneH() - 2}"/>`,
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
          `<rect class="band ${(bi + b.month) % 2 ? 'odd' : 'even'}${yearStart ? ' year-start' : ''}" x="${x0 + 1}" y="${y + barOff()}" width="${Math.max(1, w - 2)}" height="${LANE_H - 6}" rx="8" fill="url(#${(bi + b.month) % 2 ? 'tg' : 'tg2'}${i % LANE_TINTS.length}-${cal.family})"/>`,
        );
        if (yearStart && x(b.start) >= L) {
          parts.push(
            `<line class="year-line" x1="${x(b.start)}" x2="${x(b.start)}" y1="${y + barOff() - 2}" y2="${y + barOff() + LANE_H - 4}"/>`,
          );
        }
        const fullW = x(b.end) - x(b.start);
        const label = b.label;
        const maxChars = Math.floor((w - 8) / 6.4);
        const t = fit(label, maxChars);
        if (t && fullW > 18) {
          const tx = Math.max(x0, x(b.start)) + 4;
          parts.push(`<text class="band-text" x="${tx}" y="${y + barOff() + 18}">${esc(t)}</text>`);
        }
      });
      parts.push('</g>');
      const nameChars = narrow() ? 99 : Math.floor((L - 24) / 6.6);
      const nm = cal.name.length > nameChars ? cal.name.slice(0, nameChars - 1) + '.' : cal.name;
      parts.push(
        `<g class="lane-name" style="--fam:${fam}"><circle cx="${narrow() ? 14 : 8}" cy="${narrow() ? y + 10 : y + LANE_H / 2 - 1}" r="3.5"/><text x="${narrow() ? 24 : 19}" y="${narrow() ? y + 14 : y + LANE_H / 2 + 3}">${esc(nm)}</text></g>`,
      );
    });

    const bottom = laneTop + ls.length * laneH();
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
      markPts.push({
        x: xx,
        y: rowY,
        html: `<strong>${esc(ev.label)}</strong><br>${esc(formatDateTimeUtc(ev.time))}${ev.detail ? `<br><span class="muted">${esc(ev.detail)}</span>` : ''}`,
      });
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
            `<rect class="hover-lane" x="${L}" y="${laneTop + hoverLane * laneH()}" width="${plotW}" height="${laneH() - 2}"/>`,
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
    const lane = Math.floor((py - (AXIS_H + STRIP_H)) / laneH());
    return { t, lane, inPlot: px >= L && px <= L + plotW };
  }

  // ---- pointer input: mouse drag/hover, one-finger pan, two-finger pinch, tap for a card ----
  const pointers = new Map<number, { x: number; y: number; touch: boolean }>();
  let drag: { x: number; start: number; moved: boolean } | null = null;
  let pinch: { d0: number; span0: number; t0: number } | null = null;
  /** True from the moment a second finger lands until every finger is up: no tap may fire. */
  let multi = false;
  let tapOpen = false;

  const hideTip = () => {
    tip.hidden = true;
    tapOpen = false;
  };
  const clearHover = () => {
    hoverT = null;
    hoverLane = -1;
  };
  const tapSlop = (touch: boolean) => (touch ? 9 : 3);

  function pinchPoints(): { mid: { x: number; y: number }; dist: number } | null {
    const pts = [...pointers.values()];
    if (pts.length < 2) return null;
    const [a, b] = pts;
    return {
      mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      dist: Math.max(10, Math.hypot(a.x - b.x, a.y - b.y)),
    };
  }

  /** Place the card under the tapped row (or above it near the bottom), clear of the finger. */
  function placeTip(clientX: number, rowY: number, rowH: number) {
    const hostRect = svgHost.getBoundingClientRect();
    tip.hidden = false;
    const tw = Math.min(tip.offsetWidth || 240, hostRect.width - 8);
    const th = tip.offsetHeight || 96;
    const left = Math.min(Math.max(4, clientX - hostRect.left - tw / 2), hostRect.width - tw - 4);
    let top = rowY + rowH + 6;
    if (top + th > hostRect.height - 4) top = Math.max(4, rowY - th - 6);
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
  }

  const closeBtn = () => {
    const b = h('button', { type: 'button', class: 'tl-tip-x', 'aria-label': 'Close card' }, '×');
    b.addEventListener('click', () => {
      hideTip();
      clearHover();
      draw();
    });
    return b;
  };

  /** What a tap on the timeline means: the nearest sky event, or the date in that lane. */
  function showTapCard(e: PointerEvent) {
    const p = pointerT(e);
    const ls = lanes();
    const r = svgHost.getBoundingClientRect();
    const px = e.clientX - r.left;
    const py = e.clientY - r.top;
    let best: MarkPt | null = null;
    let bestD = 28;
    for (const m of markPts) {
      const d = Math.hypot(m.x - px, m.y - py);
      if (d < bestD) {
        best = m;
        bestD = d;
      }
    }
    if (best) {
      tip.innerHTML = best.html;
      tip.prepend(closeBtn());
      tapOpen = true;
      placeTip(e.clientX, best.y - 8, 16);
      return;
    }
    if (!p.inPlot || p.lane < 0 || p.lane >= ls.length) {
      hideTip();
      return;
    }
    hoverT = p.t;
    hoverLane = p.lane;
    tip.innerHTML = laneCardHtml(ls[p.lane], Math.floor(p.t));
    tip.prepend(closeBtn());
    tapOpen = true;
    placeTip(e.clientX, AXIS_H + STRIP_H + p.lane * laneH(), laneH());
  }

  function laneCardHtml(cal: Calendar | null, jdn: number): string {
    const lines: string[] = [];
    if (cal) {
      const d = cal.fromJDN(jdn);
      lines.push(`<strong>${esc(cal.name)}</strong>`, esc(d.label));
      if (d.extra) lines.push(`<span class="muted">${esc(d.extra)}</span>`);
    }
    lines.push(`<span class="muted">${esc(describeGregorian(jdn))}</span>`);
    return lines.join('<br>');
  }

  svgHost.addEventListener('pointerdown', (e) => {
    const touch = e.pointerType !== 'mouse';
    if (!touch && e.button !== 0) return;
    stopAnim?.();
    stopAnim = null;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, touch });
    svgHost.setPointerCapture(e.pointerId);
    if (pointers.size === 1) {
      multi = false;
      drag = { x: e.clientX, start, moved: false };
      return;
    }
    // A second finger turns the gesture into a pinch; the pair's midpoint stays pinned to its date.
    multi = true;
    drag = null;
    const pp = pinchPoints();
    if (!pp) return;
    const rect = svgHost.getBoundingClientRect();
    const { L, plotW } = geom();
    pinch = {
      d0: pp.dist,
      span0: span,
      t0: start + ((pp.mid.x - rect.left - L) / plotW) * span,
    };
    hideTip();
    clearHover();
  });
  svgHost.addEventListener('pointermove', (e) => {
    const known = pointers.get(e.pointerId);
    if (known) {
      known.x = e.clientX;
      known.y = e.clientY;
    }
    if (pinch) {
      const pp = pinchPoints();
      if (!pp) return;
      const rect = svgHost.getBoundingClientRect();
      const { L, plotW } = geom();
      span = Math.min(MAX_SPAN, Math.max(MIN_SPAN, (pinch.span0 * pinch.d0) / pp.dist));
      start = pinch.t0 - ((pp.mid.x - rect.left - L) / plotW) * span;
      draw();
      return;
    }
    if (drag) {
      const dx = e.clientX - drag.x;
      if (Math.abs(dx) > tapSlop(known?.touch ?? false)) drag.moved = true;
      if (drag.moved) {
        start = drag.start - (dx / geom().plotW) * span;
        hideTip();
        clearHover();
        draw();
        return;
      }
    }
    if (e.pointerType !== 'mouse') return; // touch has no hover: a tap shows the card instead
    const p = pointerT(e);
    const ls = lanes();
    if (!p.inPlot || p.lane < -1 || p.lane >= ls.length) {
      clearHover();
      hideTip();
      draw();
      return;
    }
    hoverT = p.t;
    hoverLane = p.lane;
    tip.innerHTML = laneCardHtml(p.lane >= 0 ? ls[p.lane] : null, Math.floor(p.t));
    tip.hidden = false;
    const hostRect = svgHost.getBoundingClientRect();
    const tx = Math.min(e.clientX - hostRect.left + 14, hostRect.width - 230);
    tip.style.left = `${Math.max(4, tx)}px`;
    tip.style.top = `${e.clientY - hostRect.top + 18}px`;
    draw();
  });
  const release = (e: PointerEvent, cancelled: boolean) => {
    const wasTouch = pointers.get(e.pointerId)?.touch ?? false;
    pointers.delete(e.pointerId);
    if (svgHost.hasPointerCapture(e.pointerId)) svgHost.releasePointerCapture(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (pointers.size > 0) return;
    const d = drag;
    drag = null;
    const wasMulti = multi;
    multi = false;
    if (cancelled || wasMulti || !d || d.moved) return;
    const p = pointerT(e);
    if (!p.inPlot) return;
    setDate(Math.floor(p.t));
    if (wasTouch) showTapCard(e);
  };
  svgHost.addEventListener('pointerup', (e) => release(e, false));
  svgHost.addEventListener('pointercancel', (e) => release(e, true));
  svgHost.addEventListener('pointerleave', (e) => {
    if (drag || e.pointerType !== 'mouse') return;
    clearHover();
    hideTip();
    draw();
  });
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && tapOpen) {
      hideTip();
      clearHover();
      draw();
    }
  };
  window.addEventListener('keydown', onKey);
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
  const btn = (label: string, aria: string, fn: () => void, cls = '') =>
    h(
      'button',
      { type: 'button', class: `btn ${cls}`.trim(), 'aria-label': aria, title: aria, onclick: fn },
      label,
    );
  const controls = h(
    'div',
    { class: 'tl-controls glass', role: 'group', 'aria-label': 'Timeline window' },
    btn('<', 'Pan earlier', () => pan(-span / 4), 'step-btn'),
    btn('>', 'Pan later', () => pan(span / 4), 'step-btn'),
    btn('+', 'Zoom in', () => zoom(1 / 1.5), 'step-btn'),
    btn('-', 'Zoom out', () => zoom(1.5), 'step-btn'),
    btn('Month', 'Show 45 days around the selected date', () => {
      centerOnSelected(45);
    }),
    btn('Year', 'Show one year around the selected date', () => {
      centerOnSelected(366);
    }),
    btn('10 years', 'Show ten years around the selected date', () => {
      centerOnSelected(3653);
    }),
    btn('Center', 'Center the window on the selected date', () => centerOnSelected()),
    btn(
      'Gregorian year',
      'Show the whole Gregorian year of the selected date',
      () => {
        const y = jdnToGregorian(getState().jdn).year;
        setWindow(gregorianToJDN(y, 1, 1), 365.25);
      },
      'tl-wide-only',
    ),
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
        matchMedia('(hover: none)').matches
          ? 'Each lane is a calendar. Drag sideways to pan, pinch to zoom, tap a day for its date in that calendar. Heavy lines mark where a calendar starts a new year.'
          : 'Each lane is a calendar. Drag to pan, scroll to zoom, click to pick a day. Heavy lines mark where a calendar starts a new year.',
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
    window.removeEventListener('keydown', onKey);
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
