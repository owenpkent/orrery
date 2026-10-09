import { MS_PER_DAY, UNIX_EPOCH_JDN } from '../calendars/jdn';

export const FAMILY_VAR: Record<string, string> = {
  solar: 'var(--c-solar)',
  lunar: 'var(--c-lunar)',
  lunisolar: 'var(--c-lunisolar)',
  count: 'var(--c-count)',
  invented: 'var(--c-invented)',
};

/** "in 12 days", "3 days ago", "today" relative to the noon of a JDN. */
export function relativeDays(ms: number, jdn: number): string {
  const ref = (jdn - UNIX_EPOCH_JDN) * MS_PER_DAY + MS_PER_DAY / 2;
  const days = Math.round((ms - ref) / MS_PER_DAY);
  if (days === 0) return 'today';
  const n = Math.abs(days);
  const unit = n === 1 ? 'day' : 'days';
  return days > 0 ? `in ${n} ${unit}` : `${n} ${unit} ago`;
}

export function formatDateTimeUtc(ms: number): string {
  const d = new Date(ms);
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${p(d.getUTCHours())}:${p(d.getUTCMinutes())} UTC`;
}
