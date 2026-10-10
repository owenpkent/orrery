import './styles/fonts.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/shell.css';
import './styles/home.css';
import './styles/today.css';
import './styles/timeline.css';
import './styles/ring.css';
import './styles/orrery.css';
import './styles/mobile.css';
import { VIEWS, getState, readHash, setView, subscribe, type ViewId } from './state';
import { createDateControl } from './ui/dateControl';
import { clear, h } from './ui/dom';
import { initSpotlight, reveal, transition } from './ui/fx';
import { mountHome } from './views/home';

type Mount = (root: HTMLElement) => () => unknown;

/** Home is in the main bundle (it is the landing page); the other views load on demand. */
const LOADERS: Record<ViewId, () => Promise<Mount>> = {
  home: () => Promise.resolve(mountHome),
  today: () => import('./views/today').then((m) => m.mountToday),
  timeline: () => import('./views/timeline').then((m) => m.mountTimeline),
  ring: () => import('./views/ring').then((m) => m.mountRing),
  orrery: () => import('./views/orreryCalendar').then((m) => m.mountOrreryCalendar),
};
const loaded = new Map<ViewId, Mount>([['home', mountHome]]);

function load(view: ViewId): Promise<Mount> {
  return LOADERS[view]().then((m) => {
    loaded.set(view, m);
    return m;
  });
}

/** Warm the other views once the page is idle, so tabs open instantly and view transitions stay smooth. */
function prefetchViews(): void {
  const queue = VIEWS.map((v) => v.id).filter((id) => !loaded.has(id));
  const next = () => {
    const id = queue.shift();
    if (!id) return;
    void load(id).finally(() => window.setTimeout(next, 250));
  };
  window.addEventListener('load', () => window.setTimeout(next, 2500), { once: true });
}

type Theme = 'dark' | 'light';

function loadTheme(): Theme {
  try {
    if (localStorage.getItem('orrery-theme') === 'light') return 'light';
  } catch {
    /* storage unavailable */
  }
  return 'dark';
}

function applyTheme(t: Theme): void {
  document.documentElement.setAttribute('data-theme', t);
  try {
    localStorage.setItem('orrery-theme', t);
  } catch {
    /* storage unavailable */
  }
}

const NS = 'http://www.w3.org/2000/svg';
function themeIcon(theme: Theme): SVGSVGElement {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '18');
  svg.setAttribute('height', '18');
  svg.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS(NS, 'path');
  p.setAttribute('fill', 'currentColor');
  p.setAttribute(
    'd',
    theme === 'dark'
      ? 'M12 4a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0V5a1 1 0 0 1 1-1Zm0 14a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0v-1a1 1 0 0 1 1-1ZM4 11h1a1 1 0 1 1 0 2H4a1 1 0 1 1 0-2Zm15 0h1a1 1 0 1 1 0 2h-1a1 1 0 1 1 0-2ZM6.3 6.3a1 1 0 0 1 1.4 0l.7.7A1 1 0 0 1 7 8.4l-.7-.7a1 1 0 0 1 0-1.4Zm10.3 10.3a1 1 0 0 1 1.4 0l.7.7a1 1 0 0 1-1.4 1.4l-.7-.7a1 1 0 0 1 0-1.4ZM6.3 17.7a1 1 0 0 1 0-1.4l.7-.7A1 1 0 0 1 8.4 17l-.7.7a1 1 0 0 1-1.4 0ZM16.6 7.4a1 1 0 0 1 0-1.4l.7-.7A1 1 0 0 1 18.7 6.7l-.7.7a1 1 0 0 1-1.4 0ZM12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z'
      : 'M20.2 14.6A8 8 0 0 1 9.4 3.8a1 1 0 0 0-1.3-1.2A10 10 0 1 0 21.4 15.9a1 1 0 0 0-1.2-1.3Z',
  );
  svg.append(p);
  return svg;
}

function boot(): void {
  const app = document.getElementById('app')!;
  readHash();

  let theme = loadTheme();
  applyTheme(theme);
  const themeBtn = h('button', { type: 'button', class: 'theme-btn' });
  const themeLabel = () => {
    clear(themeBtn);
    themeBtn.append(themeIcon(theme));
    const next = theme === 'dark' ? 'light' : 'dark';
    themeBtn.setAttribute('aria-label', `Switch to ${next} theme`);
    themeBtn.title = `Switch to ${next} theme`;
  };
  themeBtn.addEventListener('click', () => {
    theme = theme === 'dark' ? 'light' : 'dark';
    applyTheme(theme);
    themeLabel();
  });
  themeLabel();

  const indicator = h('span', { class: 'nav-indicator', 'aria-hidden': 'true' });
  const nav = h('nav', { class: 'tabs', 'aria-label': 'Views' }, indicator);
  const tabLinks = new Map<ViewId, HTMLAnchorElement>();
  for (const v of VIEWS) {
    const a = h('a', { href: `#/${v.id}`, class: 'tab' }, v.label);
    a.addEventListener('click', (e) => {
      e.preventDefault();
      transition(() => setView(v.id));
    });
    tabLinks.set(v.id, a);
    nav.append(a);
  }
  const placeIndicator = () => {
    const a = tabLinks.get(getState().view);
    if (!a) return;
    indicator.style.setProperty('--x', `${a.offsetLeft}px`);
    indicator.style.setProperty('--w', `${a.offsetWidth}px`);
    indicator.classList.add('ready');
  };

  const main = h('main', { id: 'view', class: 'view', tabindex: '-1' });
  clear(app);
  app.append(
    h('div', { class: 'aurora', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')),
    h('div', { class: 'grain', 'aria-hidden': 'true' }),
    h(
      'header',
      { class: 'top' },
      h(
        'div',
        { class: 'topbar glass' },
        h(
          'a',
          { class: 'brand', href: '#/home', 'aria-label': 'Orrery, home' },
          h('span', { class: 'brand-mark', 'aria-hidden': 'true' }),
          h('span', { class: 'brand-name' }, 'Orrery'),
        ),
        nav,
        themeBtn,
      ),
    ),
    main,
    h(
      'footer',
      { class: 'foot' },
      h(
        'div',
        { class: 'foot-inner' },
        h('span', { class: 'foot-brand' }, 'Orrery'),
        h(
          'p',
          {},
          'Dates are UTC civil days. Sky events computed with ',
          h(
            'a',
            { href: 'https://github.com/cosinekitty/astronomy', rel: 'noopener' },
            'astronomy-engine',
          ),
          '. The Orrery calendar is an invention; its names are placeholders.',
        ),
        h(
          'a',
          { class: 'foot-gh', href: 'https://github.com/owenpkent/orrery', rel: 'noopener' },
          'github.com/owenpkent/orrery',
        ),
      ),
    ),
    createDateControl(),
  );
  initSpotlight();

  let current: ViewId | null = null;
  let teardown: (() => unknown) | null = null;
  let stopReveal: (() => void) | null = null;
  const show = () => {
    const { view } = getState();
    for (const [id, a] of tabLinks) {
      a.classList.toggle('active', id === view);
      if (id === view) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    }
    placeIndicator();
    if (view === current) return;
    current = view;
    teardown?.();
    teardown = null;
    stopReveal?.();
    clear(main);
    document.body.dataset.view = view;
    let root: HTMLElement = main;
    if (view !== 'home') {
      root = h('div', { class: 'wrap' });
      main.append(root);
    }
    const mountNow = (mount: Mount) => {
      teardown = mount(root);
      stopReveal = reveal(main);
      window.scrollTo({ top: 0 });
    };
    const ready = loaded.get(view);
    if (ready) mountNow(ready);
    else {
      // First visit to a lazily loaded view: mount as soon as its chunk arrives (unless the user moved on).
      void load(view).then((mount) => {
        if (current === view && teardown === null) mountNow(mount);
      });
    }
  };
  subscribe(show);
  window.addEventListener('hashchange', () => {
    readHash();
    show();
  });
  window.addEventListener('resize', placeIndicator);
  void document.fonts?.ready.then(placeIndicator);
  show();
}

function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  const register = () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => undefined);
  };
  // Never compete with first paint or the hero scene: register once the page has settled.
  window.addEventListener('load', () => window.setTimeout(register, 4000), { once: true });
}

boot();
prefetchViews();
registerServiceWorker();
