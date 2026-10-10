/** Home: a live 3D sky behind the headline, today's date cycling through calendars, then a bento intro. */
import { CALENDARS, getCalendar } from '../calendars';
import type { Family } from '../calendars';
import { GREGORIAN_MONTHS, jdnToGregorian, todayJDN } from '../calendars/jdn';
import { OrbitDrag } from '../sky/orbit';
import { getState, setDate, setView, subscribe, type ViewId } from '../state';
import { addMonths, describeGregorian, SCRUB_MAX, SCRUB_MIN } from '../ui/dateControl';
import { clear, h } from '../ui/dom';
import { reducedMotion, setText, transition } from '../ui/fx';
import { FAMILY_VAR } from '../ui/format';
import type { SceneHandle } from '../scene/orreryScene';

/** Wait this long after the load event before fetching the 3D scene. */
const SCENE_DELAY_MS = 1500;

const STRIP = ['hebrew', 'islamic-umalqura', 'chinese', 'maya', 'persian', 'orrery'];

function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

/** Devices that should get the static poster instead of the live 3D scene. */
function lowPower(): boolean {
  const n = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  return (
    reducedMotion() ||
    (n.hardwareConcurrency ?? 8) <= 2 ||
    (n.deviceMemory ?? 8) <= 2 ||
    n.connection?.saveData === true
  );
}

/**
 * Run `fn` once the page has loaded, a beat later (so fonts and first interactions get the bandwidth),
 * and the main thread is idle. three.js is ~140 kB gzipped and must never delay first paint.
 */
function whenIdle(fn: () => void): () => void {
  let cancelled = false;
  let handle = 0;
  let idle = 0;
  const run = () => {
    handle = window.setTimeout(() => {
      if (cancelled) return;
      const w = window as Window & {
        requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
      };
      if (w.requestIdleCallback) idle = w.requestIdleCallback(fn, { timeout: 2500 });
      else fn();
    }, SCENE_DELAY_MS);
  };
  if (document.readyState === 'complete') run();
  else window.addEventListener('load', run, { once: true });
  return () => {
    cancelled = true;
    window.removeEventListener('load', run);
    window.clearTimeout(handle);
    (window as Window & { cancelIdleCallback?: (h: number) => void }).cancelIdleCallback?.(idle);
  };
}

function go(view: ViewId): (e: Event) => void {
  return (e) => {
    e.preventDefault();
    transition(() => setView(view));
  };
}

function link(view: ViewId, cls: string, ...kids: (Node | string)[]): HTMLAnchorElement {
  const a = h('a', { href: `#/${view}`, class: cls }, ...kids);
  a.addEventListener('click', go(view));
  return a;
}

function arrow(): HTMLElement {
  return h('span', { class: 'arrow', 'aria-hidden': 'true' }, '→');
}

export function mountHome(root: HTMLElement): () => void {
  const cleanups: (() => void)[] = [];

  // ---- hero stage ----
  const canvas = h('canvas', { class: 'hero-canvas', role: 'img' });
  const fallback = h(
    'div',
    { class: 'hero-fallback', 'aria-hidden': 'true' },
    h('span', { class: 'fb-ring r1' }),
    h('span', { class: 'fb-ring r2' }),
    h('span', { class: 'fb-ring r3' }),
    h('span', { class: 'fb-sun' }),
    h('span', { class: 'fb-earth' }),
  );
  const handleLabel = h('span', { class: 'eh-label num' });
  const handle = h(
    'div',
    {
      class: 'earth-handle',
      role: 'slider',
      tabindex: '0',
      'aria-label': 'Earth on its orbit. Drag, or press arrow keys, to change the date',
      'aria-valuemin': String(SCRUB_MIN),
      'aria-valuemax': String(SCRUB_MAX),
    },
    h('span', { class: 'eh-ring' }),
    handleLabel,
  );
  const stage = h('div', { class: 'hero-stage' }, fallback, canvas, handle);

  // ---- live strip ----
  const stripName = h('span', { class: 'ls-name' });
  const stripDate = h('span', { class: 'ls-date num' });
  const stripExtra = h('span', { class: 'ls-extra' });
  const chip = h(
    'div',
    { class: 'ls-chip', 'aria-live': 'off' },
    h('span', { class: 'ls-dot' }),
    h('div', { class: 'ls-text' }, stripName, stripDate, stripExtra),
  );
  const dots = STRIP.map((id, i) =>
    h('button', {
      type: 'button',
      class: 'ls-pip',
      'aria-label': `Show the ${getCalendar(id).name} calendar`,
      onclick: () => {
        idx = i;
        auto = false;
        renderStrip();
      },
    }),
  );
  let idx = 0;
  let auto = !reducedMotion();
  const renderStrip = () => {
    const cal = getCalendar(STRIP[idx]);
    const d = cal.fromJDN(getState().jdn);
    chip.style.setProperty('--fam', FAMILY_VAR[cal.family]);
    setText(stripName, cal.name);
    setText(stripDate, d.label);
    setText(stripExtra, d.extra ?? cal.region);
    dots.forEach((p, i) => p.classList.toggle('on', i === idx));
  };
  const timer = window.setInterval(() => {
    if (!auto || document.hidden) return;
    idx = (idx + 1) % STRIP.length;
    renderStrip();
  }, 3200);
  cleanups.push(() => window.clearInterval(timer));
  const strip = h(
    'div',
    { class: 'live-strip glass' },
    h('span', { class: 'ls-kicker eyebrow' }, 'This day in'),
    chip,
    h('div', { class: 'ls-pips', role: 'group', 'aria-label': 'Choose a calendar' }, ...dots),
  );
  strip.addEventListener('pointerenter', () => (auto = false));
  strip.addEventListener('pointerleave', () => (auto = !reducedMotion()));

  // The hero copy is the LCP element: it paints at once, with no fade-in.
  const copy = h(
    'div',
    { class: 'hero-copy' },
    h(
      'span',
      { class: 'pill eyebrow' },
      h('span', { class: 'live-dot' }),
      `Live sky · ${CALENDARS.length} calendars`,
    ),
    h(
      'h1',
      { class: 'hero-title display' },
      'Every calendar on Earth, ',
      h('em', {}, 'under one sky.'),
    ),
    h(
      'p',
      { class: 'hero-sub' },
      'Humanity counts the days in dozens of ways. Orrery lines them all up against the real sky, with solstices, moons and eclipses computed live. Drag Earth round its orbit and every calendar follows.',
    ),
    h('div', {}, strip),
    h(
      'div',
      { class: 'cta-row' },
      link('today', 'btn primary cta', 'See today in every calendar ', arrow()),
      link('timeline', 'btn cta', 'Open the timeline'),
      link('ring', 'btn cta ghost', 'Orrery ring'),
    ),
  );

  const hint = h(
    'div',
    { class: 'drag-hint glass', 'aria-hidden': 'true' },
    h('span', { class: 'grab' }, '◌'),
    'Drag Earth to travel through the year',
  );

  const hero = h('section', { class: 'hero', 'aria-label': 'Introduction' }, stage, copy, hint);

  // ---- bento ----
  const mini = {
    today: h('div', { class: 'mini-dates' }),
    ring: h('div', { class: 'mini-ring', 'aria-hidden': 'true' }),
    lanes: h('div', { class: 'mini-lanes', 'aria-hidden': 'true' }),
    month: h('div', { class: 'mini-month', 'aria-hidden': 'true' }),
  };
  const miniDates = new Map<string, HTMLElement>();
  for (const id of ['gregorian', 'hebrew', 'chinese', 'islamic-umalqura']) {
    const cal = getCalendar(id);
    const v = h('span', { class: 'md-v num' });
    miniDates.set(id, v);
    mini.today.append(
      h(
        'div',
        { class: 'md', style: `--fam:${FAMILY_VAR[cal.family]}` },
        h('span', { class: 'md-n' }, cal.name),
        v,
      ),
    );
  }
  for (let i = 0; i < 4; i++) mini.ring.append(h('i', { style: `--k:${i}` }));
  mini.ring.append(h('b'));
  const fams: Family[] = ['solar', 'lunar', 'lunisolar', 'count', 'invented'];
  fams.forEach((f, i) =>
    mini.lanes.append(
      h(
        'div',
        { class: 'ml', style: `--fam:${FAMILY_VAR[f]};--n:${i}` },
        ...[0, 1, 2, 3, 4, 5].map((j) =>
          h('i', { style: `--j:${j};--w:${55 + ((i * 7 + j * 13) % 40)}` }),
        ),
      ),
    ),
  );
  for (let d = 0; d < 30; d++) {
    mini.month.append(h('i', { class: d % 10 < 6 ? 'w' : 'o', style: `--d:${d}` }));
  }

  const card = (
    view: ViewId,
    cls: string,
    fam: Family,
    title: string,
    text: string,
    visual: HTMLElement,
    i: number,
  ) =>
    h(
      'a',
      {
        class: `bento-card glass ${cls}`,
        href: `#/${view}`,
        style: `--fam:${FAMILY_VAR[fam]}`,
        'data-reveal': '',
        'data-i': String(i),
        onclick: go(view),
      },
      h('div', { class: 'bc-visual' }, visual),
      h('div', { class: 'bc-text' }, h('h3', {}, title, ' ', arrow()), h('p', {}, text)),
    );

  const bento = h(
    'section',
    { class: 'bento-section wrap-wide', 'aria-labelledby': 'bento-h' },
    h(
      'div',
      { class: 'section-head', 'data-reveal': '' },
      h('span', { class: 'eyebrow' }, 'Four ways in'),
      h(
        'h2',
        { id: 'bento-h', class: 'display' },
        'One sky, ',
        h('em', {}, 'many'),
        ' ways to count it.',
      ),
    ),
    h(
      'div',
      { class: 'bento' },
      card(
        'today',
        'b-today',
        'solar',
        'Today, in every calendar',
        'The same day as a Hebrew date, a Chinese date, a Maya long count and fifteen more, beside the moon phase and the next solstice.',
        mini.today,
        0,
      ),
      card(
        'timeline',
        'b-timeline',
        'lunar',
        'Timeline',
        'Every calendar as a lane. Zoom from a month to a decade and watch the new years and moons drift against each other.',
        mini.lanes,
        1,
      ),
      card(
        'ring',
        'b-ring',
        'lunisolar',
        'Orrery ring',
        "The year as Earth's orbit, calendar months stacked as rings. Drag Earth to move through time.",
        mini.ring,
        2,
      ),
      card(
        'orrery',
        'b-orrery',
        'invented',
        'The Orrery calendar',
        'An invented calendar that starts on the December solstice: twelve months of thirty days, locked ten-day weeks, and a festival month to close the year, with leap years decided by the sky.',
        mini.month,
        3,
      ),
    ),
  );

  clear(root);
  root.append(hero, bento);

  // ---- scene wiring ----
  let scene: SceneHandle | null = null;
  let dragging = false;
  let disposed = false;
  const stageObs: IntersectionObserver | null =
    typeof IntersectionObserver === 'undefined'
      ? null
      : new IntersectionObserver((es) => {
          visible = es[0]?.isIntersecting ?? true;
          scene?.setActive(visible && !document.hidden);
        });
  let visible = true;
  stageObs?.observe(hero);
  const onVis = () => scene?.setActive(visible && !document.hidden);
  document.addEventListener('visibilitychange', onVis);
  cleanups.push(() => document.removeEventListener('visibilitychange', onVis));
  const ro = new ResizeObserver(() => scene?.resize());
  ro.observe(stage);
  cleanups.push(() => ro.disconnect());

  if (webglAvailable() && !lowPower()) {
    // The poster (pure CSS) is already on screen; the scene arrives later and fades in over it.
    const cancel = whenIdle(() => {
      void import('../scene/orreryScene')
        .then(async ({ createScene }) => {
          if (disposed) return;
          const s = createScene(canvas, {
            lite: window.innerWidth < 760 || matchMedia('(pointer: coarse)').matches,
            onEarth: (x, y, r) => {
              handle.style.setProperty('--x', `${x.toFixed(1)}px`);
              handle.style.setProperty('--y', `${y.toFixed(1)}px`);
              handle.style.setProperty('--r', `${Math.max(14, r).toFixed(1)}px`);
            },
          });
          s.setJdn(getState().jdn, true);
          await s.ready;
          if (disposed) {
            s.dispose();
            return;
          }
          scene = s;
          scene.setJdn(getState().jdn, true);
          scene.setActive(visible && !document.hidden);
          stage.classList.add('gl');
          hero.classList.add('has-gl');
        })
        .catch(() => stage.classList.add('no-gl'));
    });
    cleanups.push(cancel);
  } else {
    stage.classList.add('no-gl');
  }

  // ---- drag Earth ----
  let drag: OrbitDrag | null = null;
  handle.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || !scene) return;
    e.preventDefault();
    handle.setPointerCapture(e.pointerId);
    dragging = true;
    drag = new OrbitDrag(getState().jdn);
    handle.classList.add('dragging');
  });
  handle.addEventListener('pointermove', (e) => {
    if (!dragging || !drag || !scene) return;
    const a = scene.angleAt(e.clientX, e.clientY);
    if (a !== null) setDate(drag.update(a));
  });
  const endDrag = () => {
    dragging = false;
    drag = null;
    handle.classList.remove('dragging');
  };
  handle.addEventListener('pointerup', endDrag);
  handle.addEventListener('pointercancel', endDrag);
  handle.addEventListener('keydown', (e) => {
    const j = getState().jdn;
    const next: Record<string, number> = {
      ArrowRight: j + 1,
      ArrowUp: j + 1,
      ArrowLeft: j - 1,
      ArrowDown: j - 1,
      PageUp: addMonths(j, 1),
      PageDown: addMonths(j, -1),
      Home: todayJDN(),
    };
    if (e.key in next) {
      e.preventDefault();
      setDate(next[e.key]);
    }
  });

  // ---- sync with the selected date ----
  const sync = () => {
    const j = getState().jdn;
    scene?.setJdn(j, dragging);
    renderStrip();
    const g = jdnToGregorian(j);
    handleLabel.textContent = `${g.day} ${GREGORIAN_MONTHS[g.month - 1].slice(0, 3)} ${g.year}`;
    handle.setAttribute('aria-valuenow', String(Math.min(SCRUB_MAX, Math.max(SCRUB_MIN, j))));
    handle.setAttribute('aria-valuetext', describeGregorian(j));
    canvas.setAttribute(
      'aria-label',
      `Three-dimensional view of the Sun, Earth and Moon. Earth is on its orbit as it is on ${describeGregorian(j)}.`,
    );
    for (const [id, el] of miniDates) setText(el, getCalendar(id).fromJDN(j).label);
  };
  cleanups.push(subscribe(sync));
  sync();

  return () => {
    disposed = true;
    stageObs?.disconnect();
    scene?.dispose();
    for (const c of cleanups) c();
  };
}
