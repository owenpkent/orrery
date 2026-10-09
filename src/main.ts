import './styles.css';
import { VIEWS, getState, readHash, setView, subscribe, type ViewId } from './state';
import { createDateControl } from './ui/dateControl';
import { clear, h } from './ui/dom';
import { mountToday } from './views/today';
import { mountTimeline } from './views/timeline';
import { mountRing } from './views/ring';
import { mountOrreryCalendar } from './views/orreryCalendar';

const MOUNTS: Record<ViewId, (root: HTMLElement) => () => unknown> = {
  today: mountToday,
  timeline: mountTimeline,
  ring: mountRing,
  orrery: mountOrreryCalendar,
};

type Theme = 'auto' | 'light' | 'dark';

function loadTheme(): Theme {
  try {
    const t = localStorage.getItem('orrery-theme');
    if (t === 'light' || t === 'dark') return t;
  } catch {
    /* storage unavailable */
  }
  return 'auto';
}

function applyTheme(t: Theme): void {
  if (t === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
  try {
    localStorage.setItem('orrery-theme', t);
  } catch {
    /* storage unavailable */
  }
}

function boot(): void {
  const app = document.getElementById('app')!;
  readHash();

  let theme = loadTheme();
  applyTheme(theme);
  const themeBtn = h('button', { type: 'button', class: 'btn theme-btn' });
  const themeLabel = () => {
    themeBtn.textContent = `Theme: ${theme}`;
    themeBtn.setAttribute('aria-label', `Color theme: ${theme}. Click to change.`);
  };
  themeBtn.addEventListener('click', () => {
    theme = theme === 'auto' ? 'light' : theme === 'light' ? 'dark' : 'auto';
    applyTheme(theme);
    themeLabel();
  });
  themeLabel();

  const nav = h('nav', { class: 'tabs', 'aria-label': 'Views' });
  const tabLinks = new Map<ViewId, HTMLAnchorElement>();
  for (const v of VIEWS) {
    const a = h('a', { href: `#/${v.id}`, class: 'tab' }, v.label);
    a.addEventListener('click', (e) => {
      e.preventDefault();
      setView(v.id);
    });
    tabLinks.set(v.id, a);
    nav.append(a);
  }

  const main = h('main', { id: 'view', class: 'view', tabindex: '-1' });
  clear(app);
  app.append(
    h(
      'header',
      { class: 'top' },
      h(
        'div',
        { class: 'brand' },
        h('h1', {}, 'Orrery'),
        h('span', { class: 'tag-line' }, "Earth's calendars, side by side"),
      ),
      nav,
      themeBtn,
    ),
    createDateControl(),
    main,
    h(
      'footer',
      { class: 'foot' },
      'Dates are UTC civil days. Sky events computed with astronomy-engine. The Orrery calendar is an invention; its names are placeholders.',
    ),
  );

  let current: ViewId | null = null;
  let teardown: (() => unknown) | null = null;
  const show = () => {
    const { view } = getState();
    for (const [id, a] of tabLinks) {
      a.classList.toggle('active', id === view);
      if (id === view) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    }
    if (view === current) return;
    current = view;
    teardown?.();
    clear(main);
    teardown = MOUNTS[view](main);
  };
  subscribe(show);
  window.addEventListener('hashchange', () => {
    readHash();
    show();
  });
  show();
}

boot();
