import type { CalDate, Calendar } from './types';
import { gregorianToJDN } from './jdn';
import { scanSpans } from './spans';

/** 1 Vendemiaire An I = 22 September 1792 (Gregorian). */
export const FRENCH_EPOCH = gregorianToJDN(1792, 9, 22);

export const FR_MONTHS = [
  'Vendémiaire',
  'Brumaire',
  'Frimaire',
  'Nivôse',
  'Pluviôse',
  'Ventôse',
  'Germinal',
  'Floréal',
  'Prairial',
  'Messidor',
  'Thermidor',
  'Fructidor',
  'Sansculottides',
];

export const FR_DECADE_DAYS = [
  'Primidi',
  'Duodi',
  'Tridi',
  'Quartidi',
  'Quintidi',
  'Sextidi',
  'Septidi',
  'Octidi',
  'Nonidi',
  'Décadi',
];

export const FR_COMPLEMENTARY = [
  'Jour de la Vertu',
  'Jour du Génie',
  'Jour du Travail',
  "Jour de l'Opinion",
  'Jour des Récompenses',
  'Jour de la Révolution',
];

/**
 * Romme rule (the arithmetic version, not the historical one): year Y is a leap
 * year when Y is divisible by 4, except century years not divisible by 400. The
 * real Republic made years 3, 7 and 11 leap years by observing the autumn equinox
 * at Paris; the Romme rule is what calendar software uses.
 */
export function frenchIsLeap(y: number): boolean {
  return y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
}

const floorDiv = (a: number, b: number) => Math.floor(a / b);

function yearStart(y: number): number {
  const n = y - 1;
  const leaps = floorDiv(n, 4) - floorDiv(n, 100) + floorDiv(n, 400);
  return FRENCH_EPOCH + 365 * n + leaps;
}

export function frenchFromJDN(jdn: number): { year: number; month: number; day: number } {
  let year = Math.floor((jdn - FRENCH_EPOCH) / 365.2425) + 1;
  while (jdn < yearStart(year)) year--;
  while (jdn >= yearStart(year + 1)) year++;
  const doy = jdn - yearStart(year);
  return { year, month: Math.floor(doy / 30) + 1, day: (doy % 30) + 1 };
}

const ROMAN = [
  ['M', 1000],
  ['CM', 900],
  ['D', 500],
  ['CD', 400],
  ['C', 100],
  ['XC', 90],
  ['L', 50],
  ['XL', 40],
  ['X', 10],
  ['IX', 9],
  ['V', 5],
  ['IV', 4],
  ['I', 1],
] as const;

export function roman(n: number): string {
  if (n < 1) return String(n);
  let out = '';
  for (const [s, v] of ROMAN) {
    while (n >= v) {
      out += s;
      n -= v;
    }
  }
  return out;
}

function describe(jdn: number): CalDate {
  const { year, month, day } = frenchFromJDN(jdn);
  const monthName = FR_MONTHS[month - 1];
  const proleptic = year < 1 || year > 14;
  const dayName = month === 13 ? FR_COMPLEMENTARY[day - 1] : FR_DECADE_DAYS[(day - 1) % 10];
  return {
    year,
    month,
    day,
    monthName,
    weekday: dayName,
    label: `${day} ${monthName} An ${roman(year)}`,
    extra: `${dayName}, Romme rule${proleptic ? ' (extended beyond the 1792 to 1805 period of use)' : ''}`,
  };
}

export const frenchRepublican: Calendar = {
  id: 'french-republican',
  name: 'French Republican',
  family: 'solar',
  region: 'France, 1793 to 1805 (Romme rule shown)',
  blurb:
    'Twelve months of three 10-day decades, then 5 or 6 complementary days. Leap years here follow the Romme arithmetic rule, an extrapolation: the historical calendar was never run past 1805 and used equinox observation.',
  fromJDN: describe,
  monthStarts: (from, to) => scanSpans(from, to, (j) => frenchFromJDN(j).day === 1, describe, 5),
};
