import type { CalDate, Calendar } from './types';
import { WEEKDAYS, weekdayIndex } from './jdn';
import { scanSpans } from './spans';

/** GMT correlation constant: JDN of Long Count 0.0.0.0.0 (4 Ajaw 8 Kumk'u). */
export const MAYA_CORRELATION = 584283;

export const TZOLKIN_NAMES = [
  'Imix',
  "Ik'",
  "Ak'b'al",
  "K'an",
  'Chikchan',
  'Kimi',
  "Manik'",
  'Lamat',
  'Muluk',
  'Ok',
  'Chuwen',
  'Eb',
  'Ben',
  'Ix',
  'Men',
  "K'ib'",
  "Kab'an",
  "Etz'nab'",
  'Kawak',
  'Ajaw',
];

export const HAAB_NAMES = [
  'Pop',
  "Wo'",
  'Sip',
  "Sotz'",
  'Sek',
  'Xul',
  "Yaxk'in",
  'Mol',
  "Ch'en",
  'Yax',
  "Sak'",
  'Keh',
  'Mak',
  "K'ank'in",
  "Muwan'",
  'Pax',
  "K'ayab'",
  "Kumk'u",
  "Wayeb'",
];

export interface MayaDate {
  /** baktun, katun, tun, winal, kin */
  longCount: number[];
  tzolkinNumber: number;
  tzolkinName: string;
  haabDay: number;
  /** 0..18 (18 is Wayeb') */
  haabMonth: number;
  haabName: string;
}

const mod = (a: number, b: number) => ((a % b) + b) % b;

export function mayaFromJDN(jdn: number): MayaDate {
  const n = jdn - MAYA_CORRELATION;
  const kin = mod(n, 20);
  const winal = mod(Math.floor(n / 20), 18);
  const tun = mod(Math.floor(n / 360), 20);
  const katun = mod(Math.floor(n / 7200), 20);
  const baktun = Math.floor(n / 144000);
  const tzolkinNumber = mod(n + 3, 13) + 1;
  const tzolkinName = TZOLKIN_NAMES[mod(n + 19, 20)];
  const pos = mod(n + 348, 365);
  const haabMonth = Math.floor(pos / 20);
  const haabDay = pos % 20;
  return {
    longCount: [baktun, katun, tun, winal, kin],
    tzolkinNumber,
    tzolkinName,
    haabDay,
    haabMonth,
    haabName: HAAB_NAMES[haabMonth],
  };
}

function describe(jdn: number): CalDate {
  const m = mayaFromJDN(jdn);
  return {
    year: Math.floor((jdn - MAYA_CORRELATION) / 360),
    month: m.haabMonth + 1,
    day: m.haabDay,
    monthName: m.haabName,
    weekday: WEEKDAYS[weekdayIndex(jdn)],
    label: m.longCount.join('.'),
    extra: `${m.tzolkinNumber} ${m.tzolkinName}, ${m.haabDay} ${m.haabName}`,
  };
}

export const maya: Calendar = {
  id: 'maya',
  name: "Maya (Long Count, Tzolk'in, Haab')",
  family: 'count',
  region: 'Mesoamerica',
  blurb:
    "The Long Count is a plain day count in mixed base 20/18. It meshes with the 260-day Tzolk'in and the 365-day Haab' (no leap days). GMT correlation 584283. Timeline bands are Haab' months of 20 days.",
  fromJDN: describe,
  monthStarts: (from, to) => scanSpans(from, to, (j) => mayaFromJDN(j).haabDay === 0, describe, 5),
};
