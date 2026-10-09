/**
 * Celestial events from astronomy-engine, cached one Gregorian year at a time.
 * All times are instants in ms since the Unix epoch (UTC).
 */
import {
  ApsisKind,
  Body,
  EclipseKind,
  HelioDistance,
  Illumination,
  MoonPhase,
  NextGlobalSolarEclipse,
  NextLunarEclipse,
  NextMoonQuarter,
  NextPlanetApsis,
  SearchGlobalSolarEclipse,
  SearchLunarEclipse,
  SearchMoonQuarter,
  SearchPlanetApsis,
  Seasons,
  SunPosition,
} from 'astronomy-engine';
import { MS_PER_DAY, dateAtNoon } from '../calendars/jdn';

export type SkyKind =
  | 'march_equinox'
  | 'june_solstice'
  | 'september_equinox'
  | 'december_solstice'
  | 'new_moon'
  | 'first_quarter'
  | 'full_moon'
  | 'last_quarter'
  | 'lunar_eclipse'
  | 'solar_eclipse'
  | 'perihelion'
  | 'aphelion';

export interface SkyEvent {
  kind: SkyKind;
  /** Instant, ms since the Unix epoch. */
  time: number;
  label: string;
  detail?: string;
}

export const SEASON_KINDS: SkyKind[] = [
  'march_equinox',
  'june_solstice',
  'september_equinox',
  'december_solstice',
];

export const KIND_LABEL: Record<SkyKind, string> = {
  march_equinox: 'March equinox',
  june_solstice: 'June solstice',
  september_equinox: 'September equinox',
  december_solstice: 'December solstice',
  new_moon: 'New moon',
  first_quarter: 'First quarter',
  full_moon: 'Full moon',
  last_quarter: 'Last quarter',
  lunar_eclipse: 'Lunar eclipse',
  solar_eclipse: 'Solar eclipse',
  perihelion: 'Perihelion',
  aphelion: 'Aphelion',
};

const ECLIPSE_NAME: Record<string, string> = {
  [EclipseKind.Penumbral]: 'penumbral',
  [EclipseKind.Partial]: 'partial',
  [EclipseKind.Annular]: 'annular',
  [EclipseKind.Total]: 'total',
};

const QUARTER_KIND: SkyKind[] = ['new_moon', 'first_quarter', 'full_moon', 'last_quarter'];

const yearCache = new Map<number, SkyEvent[]>();

/** Instants of the four equinoxes and solstices of a Gregorian year. */
export function seasonsOf(year: number) {
  const s = Seasons(year);
  return {
    march: s.mar_equinox.date.getTime(),
    june: s.jun_solstice.date.getTime(),
    september: s.sep_equinox.date.getTime(),
    december: s.dec_solstice.date.getTime(),
  };
}

const decCache = new Map<number, number>();

/** Instant (ms) of the December solstice in a Gregorian year. Cached; used by the Orrery calendar. */
export function decemberSolstice(year: number): number {
  let v = decCache.get(year);
  if (v === undefined) {
    v = Seasons(year).dec_solstice.date.getTime();
    decCache.set(year, v);
  }
  return v;
}

function computeYear(year: number): SkyEvent[] {
  const out: SkyEvent[] = [];
  const start = new Date(Date.UTC(year, 0, 1));
  const end = Date.UTC(year + 1, 0, 1);
  const s = seasonsOf(year);
  out.push(
    { kind: 'march_equinox', time: s.march, label: KIND_LABEL.march_equinox },
    { kind: 'june_solstice', time: s.june, label: KIND_LABEL.june_solstice },
    { kind: 'september_equinox', time: s.september, label: KIND_LABEL.september_equinox },
    { kind: 'december_solstice', time: s.december, label: KIND_LABEL.december_solstice },
  );

  let mq = SearchMoonQuarter(start);
  while (mq.time.date.getTime() < end) {
    const kind = QUARTER_KIND[mq.quarter];
    out.push({ kind, time: mq.time.date.getTime(), label: KIND_LABEL[kind] });
    mq = NextMoonQuarter(mq);
  }

  let le = SearchLunarEclipse(start);
  while (le.peak.date.getTime() < end) {
    out.push({
      kind: 'lunar_eclipse',
      time: le.peak.date.getTime(),
      label: `Lunar eclipse (${ECLIPSE_NAME[le.kind]})`,
    });
    le = NextLunarEclipse(le.peak);
  }

  let se = SearchGlobalSolarEclipse(start);
  while (se.peak.date.getTime() < end) {
    out.push({
      kind: 'solar_eclipse',
      time: se.peak.date.getTime(),
      label: `Solar eclipse (${ECLIPSE_NAME[se.kind]})`,
    });
    se = NextGlobalSolarEclipse(se.peak);
  }

  let ap = SearchPlanetApsis(Body.Earth, start);
  while (ap.time.date.getTime() < end) {
    const peri = ap.kind === ApsisKind.Pericenter;
    out.push({
      kind: peri ? 'perihelion' : 'aphelion',
      time: ap.time.date.getTime(),
      label: peri ? KIND_LABEL.perihelion : KIND_LABEL.aphelion,
      detail: `${ap.dist_au.toFixed(4)} AU`,
    });
    ap = NextPlanetApsis(Body.Earth, ap);
  }

  return out.sort((a, b) => a.time - b.time);
}

export function eventsForYear(year: number): SkyEvent[] {
  let v = yearCache.get(year);
  if (!v) {
    v = computeYear(year);
    yearCache.set(year, v);
  }
  return v;
}

/** Events with fromMs <= time < toMs, optionally filtered by kind. */
export function eventsInRange(
  fromMs: number,
  toMs: number,
  kinds?: ReadonlySet<SkyKind>,
): SkyEvent[] {
  const y0 = new Date(fromMs).getUTCFullYear();
  const y1 = new Date(toMs).getUTCFullYear();
  const out: SkyEvent[] = [];
  for (let y = y0; y <= y1; y++) {
    for (const e of eventsForYear(y)) {
      if (e.time >= fromMs && e.time < toMs && (!kinds || kinds.has(e.kind))) out.push(e);
    }
  }
  return out;
}

/** Nearest event of any of `kinds` strictly before / after an instant. */
export function adjacentEvent(
  ms: number,
  kinds: ReadonlySet<SkyKind>,
  direction: -1 | 1,
): SkyEvent | undefined {
  const span = direction === 1 ? [ms, ms + 800 * MS_PER_DAY] : [ms - 800 * MS_PER_DAY, ms];
  const list = eventsInRange(span[0], span[1], kinds);
  if (direction === 1) return list.find((e) => e.time > ms);
  return [...list].reverse().find((e) => e.time < ms);
}

export const MOON_NAMES = [
  'New moon',
  'Waxing crescent',
  'First quarter',
  'Waxing gibbous',
  'Full moon',
  'Waning gibbous',
  'Last quarter',
  'Waning crescent',
];

export interface MoonState {
  angle: number;
  name: string;
  illuminated: number;
}

export function moonStateAt(ms: number): MoonState {
  const d = new Date(ms);
  const angle = MoonPhase(d);
  const name = MOON_NAMES[Math.floor((angle + 22.5) / 45) % 8];
  return { angle, name, illuminated: Illumination(Body.Moon, d).phase_fraction };
}

export interface EarthState {
  /** Heliocentric ecliptic longitude of Earth, degrees 0..360. */
  longitude: number;
  distanceAu: number;
}

const earthCache = new Map<number, EarthState>();

export function earthAtJDN(jdn: number): EarthState {
  let v = earthCache.get(jdn);
  if (!v) {
    const d = dateAtNoon(jdn);
    const lon = (SunPosition(d).elon + 180) % 360;
    v = { longitude: lon, distanceAu: HelioDistance(Body.Earth, d) };
    earthCache.set(jdn, v);
  }
  return v;
}

export function formatUtc(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())} UTC`;
}
