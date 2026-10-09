/** Earth's orbit as an angle: shared by the hero scene and the ring view. */
import { jdnFromMs, jdnToGregorian } from '../calendars/jdn';
import { decemberSolstice, earthAtJDN } from './events';

export interface OrbitWindow {
  /** JDN of the December solstice day at or before the date. */
  start: number;
  /** JDN of the next December solstice day. */
  end: number;
  /** Earth longitude (degrees) at start. */
  angle0: number;
}

const windows = new Map<number, OrbitWindow>();

export function windowFor(jdn: number): OrbitWindow {
  let y = jdnToGregorian(jdn).year;
  let s = jdnFromMs(decemberSolstice(y));
  while (s > jdn) {
    y--;
    s = jdnFromMs(decemberSolstice(y));
  }
  let w = windows.get(s);
  if (!w) {
    w = { start: s, end: jdnFromMs(decemberSolstice(y + 1)), angle0: earthAtJDN(s).longitude };
    windows.set(s, w);
  }
  return w;
}

/** Unwrapped angle (degrees, counter-clockwise seen from above) of day t within the window. */
export function angleOf(w: OrbitWindow, t: number): number {
  if (t >= w.end) return w.angle0 + 360;
  if (t <= w.start) return w.angle0;
  let d = earthAtJDN(t).longitude - w.angle0;
  d = ((d % 360) + 360) % 360;
  return w.angle0 + d;
}

/** Day in the window whose orbital angle is nearest to `deg`. */
export function jdnFromAngle(w: OrbitWindow, deg: number): number {
  const a = ((((deg - w.angle0) % 360) + 360) % 360) + w.angle0;
  let lo = w.start;
  let hi = w.end - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (angleOf(w, mid) <= a) lo = mid;
    else hi = mid - 1;
  }
  const next = Math.min(w.end - 1, lo + 1);
  return Math.abs(angleOf(w, next) - a) < Math.abs(a - angleOf(w, lo)) ? next : lo;
}

/**
 * Turns a stream of pointer angles into dates, carrying across the year boundary so that
 * dragging Earth round and round keeps moving through the years.
 */
export class OrbitDrag {
  private w: OrbitWindow;
  private lastFrac: number;

  constructor(jdn: number) {
    this.w = windowFor(jdn);
    this.lastFrac = this.fracOf(this.w, angleOf(this.w, jdn));
  }

  private fracOf(w: OrbitWindow, deg: number): number {
    return ((((deg - w.angle0) % 360) + 360) % 360) / 360;
  }

  update(deg: number): number {
    const f = this.fracOf(this.w, deg);
    if (this.lastFrac > 0.75 && f < 0.25) this.w = windowFor(this.w.end);
    else if (this.lastFrac < 0.25 && f > 0.75) this.w = windowFor(this.w.start - 1);
    this.lastFrac = f;
    return jdnFromAngle(this.w, deg);
  }
}
