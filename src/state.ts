/** App state: the selected day (a JDN) and the current view, mirrored in the URL hash. */
import { isoToJdn, jdnToIso, todayJDN } from './calendars/jdn';

export type ViewId = 'home' | 'today' | 'timeline' | 'ring' | 'orrery';

export const VIEWS: { id: ViewId; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'today', label: 'Today' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'ring', label: 'Ring' },
  { id: 'orrery', label: 'Calendar' },
];

export interface AppState {
  jdn: number;
  view: ViewId;
}

type Listener = (s: AppState) => void;

const listeners = new Set<Listener>();
const state: AppState = { jdn: todayJDN(), view: 'home' };

export function getState(): Readonly<AppState> {
  return state;
}

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit(): void {
  for (const fn of [...listeners]) fn(state);
}

function writeHash(): void {
  const hash = `#/${state.view}?d=${jdnToIso(state.jdn)}`;
  if (location.hash !== hash) history.replaceState(null, '', hash);
}

export function setDate(jdn: number): void {
  const v = Math.round(jdn);
  if (v === state.jdn) return;
  state.jdn = v;
  writeHash();
  emit();
}

export function setView(view: ViewId): void {
  if (view === state.view) return;
  state.view = view;
  writeHash();
  emit();
}

/** Read the hash into state. Returns true if anything changed. */
export function readHash(): boolean {
  const m = /^#\/([a-z]+)(?:\?(.*))?$/.exec(location.hash);
  let changed = false;
  if (m) {
    const view = VIEWS.find((v) => v.id === m[1]);
    if (view && view.id !== state.view) {
      state.view = view.id;
      changed = true;
    }
    const d = new URLSearchParams(m[2] ?? '').get('d');
    const j = d ? isoToJdn(d) : null;
    if (j !== null && j !== state.jdn) {
      state.jdn = j;
      changed = true;
    }
  }
  if (changed) emit();
  return changed;
}
