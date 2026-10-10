/** Orrery ring: one solstice-to-solstice orbit, with calendar months as concentric rings. */
import { CALENDARS } from '../calendars';
import { WEEKDAYS, weekdayIndex } from '../calendars/jdn';
import { earthAtJDN } from '../sky/events';
import { OrbitDrag, angleOf, windowFor, type OrbitWindow } from '../sky/orbit';
import { getState, setDate, subscribe } from '../state';
import { addMonths, describeGregorian } from '../ui/dateControl';
import { clear, esc, h } from '../ui/dom';
import { setText, tween } from '../ui/fx';
import { FAMILY_VAR } from '../ui/format';
import { fit } from './timeline';

const SIZE = 920;
const C = SIZE / 2;
// The view box is wider than the orbit so the equinox labels fit beside it.
const VB = { x: -110, y: -12, w: SIZE + 280, h: SIZE + 30 };
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

function sector(rIn: number, rOut: number, a0: number, a1: number): string {
  const large = a1 - a0 > 180 ? 1 : 0;
  return (
    `M${px(rOut, a0)} ${py(rOut, a0)} A${rOut} ${rOut} 0 ${large} 0 ${px(rOut, a1)} ${py(rOut, a1)} ` +
    `L${px(rIn, a1)} ${py(rIn, a1)} A${rIn} ${rIn} 0 ${large} 1 ${px(rIn, a0)} ${py(rIn, a0)} Z`
  );
}

function arcPath(r: number, a0: number, a1: number): string {
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M${px(r, a0)} ${py(r, a0)} A${r} ${r} 0 ${large} 0 ${px(r, a1)} ${py(r, a1)}`;
}

export function mountRing(root: HTMLElement): () => void {
  const on = new Set(DEFAULT_ON);
  const host = h('div', { class: 'ring-slot' });
  // Touch can only drag Earth from this overlay (touch-action: none lives here and nowhere else on the
  // ring), so a finger on the rings still scrolls the page. Mouse users drag anywhere on the rings.
  const handle = h('div', { class: 'ring-handle', 'aria-hidden': 'true' });
  const tipBox = h('div', { class: 'ring-tip', role: 'status', 'aria-live': 'polite' });
  const tipHint = matchMedia('(hover: none)').matches
    ? 'Tap a ring to see which month it is.'
    : 'Hover a ring to see which month it is.';
  const showTip = (data?: string) => {
    clear(tipBox);
    if (!data) {
      tipBox.append(h('span', { class: 'muted' }, tipHint));
      return;
    }
    const [name, month, starts] = data.split('|');
    tipBox.append(h('strong', {}, name), ' ', month, h('span', { class: 'muted' }, ` (${starts})`));
  };
  showTip();
  const stage = h('div', { class: 'ring-host' }, host, handle);

  const infoDate = h('p', { class: 'ring-date display' });
  const infoWeekday = h('span', { class: 'eyebrow' });
  const stat = (label: string) => {
    const v = h('span', { class: 'rs-v num' });
    return { v, el: h('div', { class: 'rs' }, h('span', { class: 'rs-l' }, label), v) };
  };
  const sDist = stat('Distance from the Sun');
  const sLon = stat('Orbital longitude');
  const sDay = stat('Day of the orbit');
  const info = h(
    'div',
    { class: 'panel glass ring-info', 'data-reveal': '', 'data-i': '2' },
    infoWeekday,
    infoDate,
    h('div', { class: 'rs-grid' }, sDist.el, sLon.el, sDay.el),
    h(
      'p',
      { class: 'muted ring-note' },
      "Months sit at Earth's true orbital angle, so they look slightly uneven: Earth runs fastest near January perihelion and slowest near July. Drag Earth, or anywhere around the rings, to travel through the year.",
    ),
  );

  // Persistent state between draws
  let win: OrbitWindow = windowFor(getState().jdn);
  let shownKey = '';
  let curAng = angleOf(win, getState().jdn);
  let stopTween: (() => void) | null = null;
  let dragging: OrbitDrag | null = null;
  let earthG: SVGGElement;
  let earthLine: SVGLineElement;
  let travelled: SVGPathElement;
  let glowArc: SVGPathElement;

  function placeEarth(ang: number) {
    curAng = ang;
    const ex = px(R_ORBIT, ang);
    const ey = py(R_ORBIT, ang);
    earthG.setAttribute('transform', `translate(${ex} ${ey})`);
    handle.style.left = `${(((ex - VB.x) / VB.w) * 100).toFixed(3)}%`;
    handle.style.top = `${(((ey - VB.y) / VB.h) * 100).toFixed(3)}%`;
    earthLine.setAttribute('x2', String(ex));
    earthLine.setAttribute('y2', String(ey));
    const d = arcPath(R_ORBIT, win.angle0, Math.max(win.angle0 + 0.01, ang));
    travelled.setAttribute('d', d);
    glowArc.setAttribute('d', d);
  }

  function drawStatic() {
    win = windowFor(getState().jdn);
    const w = win;
    const shown = CALENDARS.filter((c) => on.has(c.id));
    shownKey = `${w.start}|${[...on].sort().join(',')}`;
    const parts: string[] = [];
    parts.push(
      `<svg xmlns="http://www.w3.org/2000/svg" class="ring-svg" viewBox="${VB.x} ${VB.y} ${VB.w} ${VB.h}" role="group" aria-label="The year as a ring around the sun. Drag Earth to change the date.">`,
      `<defs>
        <radialGradient id="rg-sun"><stop offset="0" stop-color="#fff6d6"/><stop offset=".45" stop-color="#ffc15a"/><stop offset="1" stop-color="#ff7a2a"/></radialGradient>
        <radialGradient id="rg-glow"><stop offset="0" stop-color="#ffb454" stop-opacity=".75"/><stop offset=".5" stop-color="#ff8a3a" stop-opacity=".18"/><stop offset="1" stop-color="#ff8a3a" stop-opacity="0"/></radialGradient>
        <radialGradient id="rg-earth" cx=".35" cy=".3"><stop offset="0" stop-color="#bfe0ff"/><stop offset=".55" stop-color="#3b84e0"/><stop offset="1" stop-color="#0e2f78"/></radialGradient>
        <radialGradient id="rg-earthglow"><stop offset=".3" stop-color="#6cb2ff" stop-opacity=".6"/><stop offset="1" stop-color="#6cb2ff" stop-opacity="0"/></radialGradient>
        <filter id="rg-blur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="6"/></filter>
      </defs>`,
    );
    parts.push(`<circle cx="${C}" cy="${C}" r="${R_ORBIT}" class="orbit"/>`);
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
        const data = `${cal.name}|${b.label} ${b.year}|starts ${describeGregorian(b.start)}`;
        parts.push(
          `<path class="seg ${(bi + b.month) % 2 ? 'odd' : 'even'}${yearStart ? ' year-start' : ''}" data-tip="${esc(data)}" d="${sector(rIn, rOut, a0, a1)}"><title>${esc(tip)}</title></path>`,
        );
        const mid = (a0 + a1) / 2;
        const rMid = (rIn + rOut) / 2;
        const arc = ((a1 - a0) * Math.PI * rMid) / 180;
        const chars = Math.floor((arc - 6) / 6.2);
        if (fit(b.label, chars)) {
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
      parts.push(
        `<text class="ring-name" x="${C - 6}" y="${C - (rOut + rIn) / 2 + 4}" text-anchor="end">${esc(cal.name)}</text>`,
      );
      parts.push('</g>');
    });

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
    parts.push(
      `<circle cx="${C}" cy="${C}" r="${R_SUN * 3.4}" fill="url(#rg-glow)" class="sun-halo"/>`,
      `<circle class="sun" cx="${C}" cy="${C}" r="${R_SUN}" fill="url(#rg-sun)"/>`,
      `<text class="sun-text" x="${C}" y="${C + 4}" text-anchor="middle">Sun</text>`,
      `<path class="orbit-arc-glow" filter="url(#rg-blur)"/>`,
      `<path class="orbit-arc"/>`,
      `<line class="earth-line" x1="${C}" y1="${C}" x2="${C}" y2="${C}"/>`,
      `<g class="earth-g" tabindex="0" role="slider" aria-label="Earth on its orbit. Drag, or press arrow keys, to change the date.">
         <circle r="40" fill="url(#rg-earthglow)" class="earth-halo"/>
         <circle r="30" fill="transparent" class="earth-hit"/>
         <circle class="earth" r="15" fill="url(#rg-earth)"/>
         <circle class="earth-focus" r="23" fill="none"/>
       </g>`,
      '</svg>',
    );
    host.innerHTML = parts.join('');
    earthG = host.querySelector<SVGGElement>('.earth-g')!;
    earthLine = host.querySelector<SVGLineElement>('.earth-line')!;
    travelled = host.querySelector<SVGPathElement>('.orbit-arc')!;
    glowArc = host.querySelector<SVGPathElement>('.orbit-arc-glow')!;
    wire(host.querySelector('svg')!);
  }

  function pointerAngle(svg: SVGSVGElement, ev: PointerEvent): { deg: number; radius: number } {
    const r = svg.getBoundingClientRect();
    const sx = VB.x + ((ev.clientX - r.left) / r.width) * VB.w - C;
    const sy = C - (VB.y + ((ev.clientY - r.top) / r.height) * VB.h);
    return { deg: (Math.atan2(sy, sx) * 180) / Math.PI, radius: Math.hypot(sx, sy) };
  }

  function startDrag(ev: PointerEvent, el: Element, deg: number) {
    ev.preventDefault();
    el.setPointerCapture(ev.pointerId);
    dragging = new OrbitDrag(getState().jdn);
    host.querySelector('svg')?.classList.add('dragging');
    stopTween?.();
    setDate(dragging.update(deg));
  }
  const endDrag = () => {
    dragging = null;
    host.querySelector('svg')?.classList.remove('dragging');
  };

  // Touch drag: only from the overlay that sits on Earth.
  handle.addEventListener('pointerdown', (ev) => {
    const svg = host.querySelector('svg');
    if (!svg || (ev.pointerType === 'mouse' && ev.button !== 0)) return;
    startDrag(ev, handle, pointerAngle(svg, ev).deg);
  });
  handle.addEventListener('pointermove', (ev) => {
    const svg = host.querySelector('svg');
    if (dragging && svg) setDate(dragging.update(pointerAngle(svg, ev).deg));
  });
  handle.addEventListener('pointerup', endDrag);
  handle.addEventListener('pointercancel', endDrag);

  function wire(svg: SVGSVGElement) {
    // Mouse: drag from anywhere on the rings. Touch: a tap jumps to that point and explains the ring.
    let tap: { x: number; y: number; data?: string; moved: boolean } | null = null;
    svg.addEventListener('pointerdown', (ev) => {
      const p = pointerAngle(svg, ev);
      const onRings = p.radius >= R_SUN && p.radius <= R_ORBIT + 24;
      if (ev.pointerType === 'mouse') {
        if (ev.button !== 0 || !onRings) return;
        startDrag(ev, svg, p.deg);
        return;
      }
      const seg = (ev.target as Element).closest?.('.seg');
      tap = {
        x: ev.clientX,
        y: ev.clientY,
        data: seg?.getAttribute('data-tip') ?? undefined,
        moved: false,
      };
    });
    svg.addEventListener('pointermove', (ev) => {
      if (ev.pointerType !== 'mouse') {
        if (tap && Math.hypot(ev.clientX - tap.x, ev.clientY - tap.y) > 9) tap.moved = true;
        return;
      }
      if (dragging) setDate(dragging.update(pointerAngle(svg, ev).deg));
    });
    svg.addEventListener('pointerover', (ev) => {
      if (ev.pointerType !== 'mouse' || dragging) return;
      showTip((ev.target as Element).closest?.('.seg')?.getAttribute('data-tip') ?? undefined);
    });
    svg.addEventListener('pointerup', (ev) => {
      if (ev.pointerType === 'mouse') return endDrag();
      const t = tap;
      tap = null;
      if (!t || t.moved) return;
      const p = pointerAngle(svg, ev);
      if (p.radius >= R_SUN && p.radius <= R_ORBIT + 24) {
        setDate(new OrbitDrag(getState().jdn).update(p.deg));
        showTip(t.data);
      }
    });
    svg.addEventListener('pointercancel', (ev) => {
      tap = null;
      if (ev.pointerType === 'mouse') endDrag();
    });
    earthG.addEventListener('keydown', (ev) => {
      const j = getState().jdn;
      const k: Record<string, number> = {
        ArrowRight: j + 1,
        ArrowUp: j + 1,
        ArrowLeft: j - 1,
        ArrowDown: j - 1,
        PageUp: addMonths(j, 1),
        PageDown: addMonths(j, -1),
      };
      if (ev.key in k) {
        ev.preventDefault();
        setDate(k[ev.key]);
      }
    });
  }

  function update() {
    const jdn = getState().jdn;
    const nextWin = windowFor(jdn);
    const key = `${nextWin.start}|${[...on].sort().join(',')}`;
    const hadFocus = host.contains(document.activeElement);
    if (key !== shownKey) {
      stopTween?.();
      drawStatic();
      placeEarth(angleOf(win, jdn));
      if (hadFocus) earthG.focus();
    } else {
      const target = angleOf(win, jdn);
      stopTween?.();
      if (dragging) placeEarth(target);
      else stopTween = tween(curAng, target, 650, placeEarth);
    }
    earthG.setAttribute('aria-valuetext', describeGregorian(jdn));
    earthG.setAttribute('aria-valuenow', String(jdn - win.start));
    earthG.setAttribute('aria-valuemin', '0');
    earthG.setAttribute('aria-valuemax', String(win.end - win.start - 1));

    const e = earthAtJDN(jdn);
    setText(infoWeekday, WEEKDAYS[weekdayIndex(jdn)]);
    setText(infoDate, describeGregorian(jdn).split(' ').slice(1).join(' '));
    setText(sDist.v, `${e.distanceAu.toFixed(4)} AU`);
    setText(sLon.v, `${e.longitude.toFixed(1)}°`);
    setText(sDay.v, `${jdn - win.start + 1} of ${win.end - win.start}`);
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
      update();
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
    h('h1', { class: 'view-title', 'data-reveal': '' }, 'The year, as ', h('em', {}, 'an orbit.')),
    h(
      'div',
      { class: 'ring-view' },
      h('div', { class: 'ring-main panel glass', 'data-reveal': '', 'data-i': '1' }, stage, tipBox),
      h(
        'div',
        { class: 'ring-side' },
        info,
        h('div', { class: 'panel glass', 'data-reveal': '', 'data-i': '3' }, fam),
      ),
    ),
  );
  update();
  const unsub = subscribe(update);
  return () => {
    stopTween?.();
    unsub();
  };
}
