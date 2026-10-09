/** Tiny DOM helpers. No framework; views build elements and wire events directly. */

type Child = Node | string | null | undefined | false;

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Record<string, unknown> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = String(v);
    else if (k === 'text') el.textContent = String(v);
    else if (k.startsWith('on') && typeof v === 'function') {
      el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    } else if (k in el && k !== 'list' && k !== 'style') {
      (el as unknown as Record<string, unknown>)[k] = v;
    } else el.setAttribute(k, v === true ? '' : String(v));
  }
  append(el, children);
  return el;
}

export function append(el: Element, children: Child[]): void {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    el.append(typeof c === 'string' ? document.createTextNode(c) : c);
  }
}

export function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function clear(el: Element): void {
  while (el.firstChild) el.removeChild(el.firstChild);
}

/** Button that also repeats while the pointer is held down. */
export function repeatButton(
  label: string,
  ariaLabel: string,
  onStep: () => void,
  className = 'btn',
): HTMLButtonElement {
  const b = h(
    'button',
    { type: 'button', class: className, 'aria-label': ariaLabel, title: ariaLabel },
    label,
  );
  let timer: number | undefined;
  let interval: number | undefined;
  const stop = () => {
    window.clearTimeout(timer);
    window.clearInterval(interval);
    timer = interval = undefined;
  };
  b.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    onStep();
    b.dataset.pointerStepped = '1';
    stop();
    timer = window.setTimeout(() => {
      interval = window.setInterval(onStep, 90);
    }, 450);
  });
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel', 'blur'])
    b.addEventListener(ev, stop);
  // Keyboard activation arrives as a click with no preceding pointerdown.
  b.addEventListener('click', () => {
    if (b.dataset.pointerStepped) delete b.dataset.pointerStepped;
    else onStep();
  });
  return b;
}
