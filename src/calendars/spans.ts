import type { CalDate, MonthSpan } from './types';

/**
 * Build month bands by scanning days and starting a new band wherever `isStart`
 * says a month begins. `minLen` lets the scan skip days a month can never end on.
 */
export function scanSpans(
  fromJdn: number,
  toJdn: number,
  isStart: (jdn: number) => boolean,
  describe: (jdn: number) => CalDate,
  minLen = 1,
): MonthSpan[] {
  // Walk back to find the start of the band containing fromJdn.
  let first = fromJdn;
  for (let i = 0; i < 400 && !isStart(first); i++) first--;
  const spans: MonthSpan[] = [];
  let cur = first;
  let j = first + Math.max(1, minLen);
  const limit = toJdn + 1;
  while (cur <= toJdn) {
    while (j < limit + 400 && !isStart(j)) j++;
    const d = describe(cur);
    spans.push({ start: cur, end: j, label: d.monthName, year: d.year, month: d.month });
    cur = j;
    j = cur + Math.max(1, minLen);
    if (spans.length > 5000) break;
  }
  return spans;
}
