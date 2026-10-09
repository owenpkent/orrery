/** Small motion helpers: spotlight, reveals, text swaps, view transitions. All honour reduced motion. */

export const reducedMotion = (): boolean =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Cursor-follow highlight for every .glass element (CSS reads --mx and --my). */
export function initSpotlight(): void {
  let raf = 0;
  let last: PointerEvent | null = null;
  const apply = () => {
    raf = 0;
    const e = last;
    if (!e) return;
    const el = (e.target as Element | null)?.closest?.<HTMLElement>('.glass');
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - r.left}px`);
    el.style.setProperty('--my', `${e.clientY - r.top}px`);
  };
  document.addEventListener(
    'pointermove',
    (e) => {
      last = e;
      if (!raf) raf = requestAnimationFrame(apply);
    },
    { passive: true },
  );
}

/** Fade-and-rise on first view. Children of `root` marked data-reveal get a stagger index. */
export function reveal(root: ParentNode): () => void {
  const items = [...root.querySelectorAll<HTMLElement>('[data-reveal]')];
  items.forEach((el, i) => el.style.setProperty('--i', String(el.dataset.i ?? i % 8)));
  if (reducedMotion() || typeof IntersectionObserver === 'undefined') {
    items.forEach((el) => el.classList.add('in'));
    return () => undefined;
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const en of entries) {
        if (en.isIntersecting) {
          en.target.classList.add('in');
          io.unobserve(en.target);
        }
      }
    },
    { threshold: 0.12, rootMargin: '0px 0px -6% 0px' },
  );
  items.forEach((el) => io.observe(el));
  return () => io.disconnect();
}

/** Set text and replay a short swap animation when it changed. */
export function setText(el: HTMLElement, text: string): void {
  if (el.textContent === text) return;
  el.textContent = text;
  if (reducedMotion()) return;
  el.classList.remove('tick');
  void el.offsetWidth;
  el.classList.add('tick');
}

/** Run a DOM swap inside a View Transition where supported. */
export function transition(swap: () => void): void {
  const d = document as Document & { startViewTransition?: (cb: () => void) => unknown };
  if (reducedMotion() || !d.startViewTransition) swap();
  else d.startViewTransition(swap);
}

/** Ease a number toward a target each frame; returns a stop function. */
export function tween(
  from: number,
  to: number,
  ms: number,
  onFrame: (v: number) => void,
): () => void {
  if (reducedMotion() || from === to) {
    onFrame(to);
    return () => undefined;
  }
  const t0 = performance.now();
  let raf = 0;
  const step = (now: number) => {
    const p = Math.min(1, (now - t0) / ms);
    const e = 1 - Math.pow(1 - p, 4);
    onFrame(from + (to - from) * e);
    if (p < 1) raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
  return () => cancelAnimationFrame(raf);
}
