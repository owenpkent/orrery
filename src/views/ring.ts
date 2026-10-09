/** Orrery ring: one solstice-to-solstice orbit, with calendar months as concentric rings. */
import { CALENDARS } from '../calendars';
import { jdnFromMs, jdnToGregorian } from '../calendars/jdn';
import { decemberSolstice, earthAtJDN } from '../sky/events';
import { getState, setDate, subscribe } from '../state';
import { describeGregorian } from '../ui/dateControl';
import { clear, esc, h } from '../ui/dom';
import { FAMILY_VAR } from '../ui/format';
import { fit } from './timeline';

const SIZE = 920;
const C = SIZE / 2;
// The view box is wider than the orbit so the equinox labels fit beside it.
const VB = { x: -110, y: -12, w: SIZE + 220, h: SIZE + 30 };
const R_ORBIT = 424;
const R_OUTER = 396;
const THICK = 24;
const GAP = 3;
const R_SUN = 46;

const DEFAULT_ON = new Set([
  'gregorian',
  'orrery',
  'persian',
  'islamic-umalqura',
  'hebrew',
  'chinese',
  'french-republican',
]);

const rad = (deg: number) => (deg * Math.PI) / 180;
const px = (r: number, deg: number) => C + r * Math.cos(rad(deg));
const py = (r: number, deg: number) => C - r * Math.sin(rad(deg));

interface Window {
  start: number; // jdn of the December solstice day at or before the date
  end: number; // jdn of the next December solstice day
  angle0: number; // Earth longitude (deg) at start
}

function windowFor(jdn: number): Window {
  let y = jdnToGregorian(jdn).year;
  let s = jdnFromMs(decemberSolstice(y));
  while (s > jdn) {
    y--;
    s = jdnFromMs(decemberSolstice(y));
  }
  return { start: s, end: jdnFromMs(decemberSolstice(y + 1)), angle0: earthAtJDN(s).longitude };
}

/** Unwrapped angle (degrees, increasing counter-clockwise on screen) of day t within the window. */
function angleOf(w: Window, t: number): number {
  if (t >= w.end) return w.angle0 + 360;
  if (t <= w.start) return w.angle0;
  let d = earthAtJDN(t).longitude - w.angle0;
  d = ((d % 360) + 360) % 360;
  return w.angle0 + d;
}

function sector(rIn: number, rOut: number, a0: number, a1: number): string {
  const large = a1 - a0 > 180 ? 1 : 0;
  return (
    `M${px(rOut, a0)} ${py(rOut, a0)} A${rOut} ${rOut} 0 ${large} 0 ${px(rOut, a1)} ${py(rOut, a1)} ` +
    `L${px(rIn, a1)} ${py(rIn, a1)} A${rIn} ${rIn} 0 ${large} 1 ${px(rIn, a0)} ${py(rIn, a0)} Z`
  );
}

export function mountRing(root: HTMLElement): () => void {
  const on = new Set(DEFAULT_ON);
  const host = h('div', { class: 'ring-host' });
  const info = h('div', { class: 'panel ring-info', 'aria-live': 'polite' });

  function draw() {
    const jdn = getState().jdn;
    const w = windowFor(jdn);
    const shown = CALENDARS.filter((c) => on.has(c.id));
    const parts: string[] = [];
    parts.push(
      `<svg xmlns="http://www.w3.org/2000/svg" class="ring-svg" viewBox="${VB.x} ${VB.y} ${VB.w} ${VB.h}" role="img" aria-label="The year as a ring around the sun">`,
    );
    // Orbit
    parts.push(`<circle class="orbit" cx="${C}" cy="${C}" r="${R_ORBIT}"/>`);
    // Rings
    const ringR = (i: number) => R_OUTER - i * (THICK + GAP);
    shown.forEach((cal, i) => {
      const rOut = ringR(i);
      const rIn = rOut - THICK;
      if (rIn < R_SUN + 14) return;
      const bands = cal.monthStarts(w.start, w.end - 1);
      parts.push(`<g class="rg" style="--fam:${FAMILY_VAR[cal.family]}">`);
      let prevYear: number | null = null;
      bands.forEach((b, bi) => {
        const s = Math.max(b.start, w.start);
        const e = Math.min(b.end, w.end);
        const yearStart = prevYear !== null && b.year !== prevYear;
        prevYear = b.year;
        if (e <= s) return;
        const a0 = angleOf(w, s);
        const a1 = angleOf(w, e);
        const tip = `${cal.name}: ${b.label} ${b.year}`;
        parts.push(
          `<path class="seg ${(bi + b.month) % 2 ? 'odd' : 'even'}${yearStart ? ' year-start' : ''}" d="${sector(rIn, rOut, a0, a1)}"><title>${esc(tip)}</title></path>`,
        );
        // Label if there is room.
        const mid = (a0 + a1) / 2;
        const rMid = (rIn + rOut) / 2;
        const arc = ((a1 - a0) * Math.PI * rMid) / 180;
        const chars = Math.floor((arc - 6) / 6.2);
        const t = fit(b.label, chars);
        if (t) {
          let rot = 90 - mid;
          rot = ((((rot + 180) % 360) + 360) % 360) - 180;
          if (Math.abs(rot) > 90) rot += 180;
          const t =
            b.label.length > chars ? b.label.slice(0, Math.max(1, chars - 1)) + '.' : b.label;
          parts.push(
            `<text class="seg-text" transform="translate(${px(rMid, mid)} ${py(rMid, mid)}) rotate(${rot})" text-anchor="middle" dy="3.5">${esc(t)}</text>`,
          );
        }
      });
      parts.push('</g>');
      // ring name at the window start (top), on the left of the gap
      parts.push(
        `<text class="ring-name" x="${C - 6}" y="${C - (rOut + rIn) / 2 + 4}" text-anchor="end" style="--fam:${FAMILY_VAR[cal.family]}">${esc(cal.name)}</text>`,
      );
    });

    // Cardinal markers: Earth longitude 90 = December solstice (top) ... counterclockwise.
    const cardinals: [number, string][] = [
      [90, 'December solstice'],
      [180, 'March equinox'],
      [270, 'June solstice'],
      [0, 'September equinox'],
    ];
    for (const [deg, label] of cardinals) {
      parts.push(
        `<line class="cardinal" x1="${px(R_SUN + 2, deg)}" y1="${py(R_SUN + 2, deg)}" x2="${px(R_ORBIT + 10, deg)}" y2="${py(R_ORBIT + 10, deg)}"/>`,
      );
      const lx = px(R_ORBIT + 22, deg);
      const ly = py(R_ORBIT + 22, deg);
      const anchor = deg === 180 ? 'end' : deg === 0 ? 'start' : 'middle';
      const dy = deg === 90 ? -2 : deg === 270 ? 12 : 4;
      parts.push(
        `<text class="cardinal-text" x="${deg === 180 ? lx - 4 : deg === 0 ? lx + 4 : lx}" y="${ly + dy}" text-anchor="${anchor}">${label}</text>`,
      );
    }
    // Perihelion (~early January) and aphelion marks use the actual Earth distance.
    // Sun
    parts.push(`<circle class="sun-glow" cx="${C}" cy="${C}" r="${R_SUN + 10}"/>`);
    parts.push(`<circle class="sun" cx="${C}" cy="${C}" r="${R_SUN}"/>`);
    parts.push(`<text class="sun-text" x="${C}" y="${C + 4}" text-anchor="middle">Sun</text>`);

    // Earth
    const ang = angleOf(w, jdn);
    const ex = px(R_ORBIT, ang);
    const ey = py(R_ORBIT, ang);
    parts.push(
      `<line class="earth-line" x1="${C}" y1="${C}" x2="${ex}" y2="${ey}"/>`,
      `<circle class="earth" cx="${ex}" cy="${ey}" r="13"/>`,
      `<text class="earth-text" x="${ex}" y="${ey + 4}" text-anchor="middle">E</text>`,
    );
    parts.push('</svg>');
    host.innerHTML = parts.join('');

    // Click to select a day: nearest day whose angle matches the click angle.
    const svg = host.querySelector('svg')!;
    svg.addEventListener('click', (ev) => {
      const r = svg.getBoundingClientRect();
      const sx = VB.x + ((ev.clientX - r.left) / r.width) * VB.w - C;
      const sy = C - (VB.y + ((ev.clientY - r.top) / r.height) * VB.h);
      const radius = Math.hypot(sx, sy);
      if (radius < R_SUN || radius > R_ORBIT + 20) return;
      let a = (Math.atan2(sy, sx) * 180) / Math.PI;
      a = ((((a - w.angle0) % 360) + 360) % 360) + w.angle0;
      let best = w.start;
      let bestD = Infinity;
      for (let t = w.start; t < w.end; t++) {
        const lo = angleOf(w, t);
        const hi = angleOf(w, t + 1);
        const d = a >= lo && a < hi ? 0 : Math.min(Math.abs(a - lo), Math.abs(a - hi));
        if (d < bestD) {
          bestD = d;
          best = t;
        }
      }
      setDate(best);
    });

    // Info panel
    const e = earthAtJDN(jdn);
    clear(info);
    info.append(
      h('h2', {}, 'Where Earth is'),
      h('p', { class: 'big' }, describeGregorian(jdn)),
      h(
        'p',
        { class: 'muted' },
        `Orbit window: solstice day to solstice day (${w.end - w.start} days). Earth is ${e.distanceAu.toFixed(4)} AU from the Sun, at heliocentric ecliptic longitude ${e.longitude.toFixed(1)} degrees.`,
      ),
      h(
        'p',
        { class: 'muted' },
        "Months are placed by Earth's true orbital angle, so they look slightly uneven: Earth moves fastest near January perihelion and slowest near July. Click any ring to pick a day.",
      ),
    );
  }

  const fam = h(
    'fieldset',
    { class: 'toggle-group' },
    h('legend', {}, 'Rings shown (outermost first)'),
  );
  const checks = h('div', { class: 'lane-checks' });
  for (const c of CALENDARS) {
    const cb = h('input', { type: 'checkbox', checked: on.has(c.id) });
    cb.addEventListener('change', () => {
      if (cb.checked) on.add(c.id);
      else on.delete(c.id);
      draw();
    });
    checks.append(
      h(
        'label',
        { class: 'chk', style: `--fam:${FAMILY_VAR[c.family]}` },
        cb,
        h('span', { class: 'key fam' }),
        c.name,
      ),
    );
  }
  fam.append(checks);

  clear(root);
  root.append(
    h(
      'div',
      { class: 'ring-view' },
      h('div', { class: 'ring-main' }, host),
      h('div', { class: 'ring-side' }, info, fam),
    ),
  );
  draw();
  return subscribe(draw);
}
