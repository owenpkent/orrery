# Calendars implemented

Every calendar is one module under `src/calendars/` that exports a `Calendar` (see
`src/calendars/types.ts`) and is registered in `src/calendars/index.ts`. This file documents what
each one does, where its algorithm comes from, its epoch, its known limits, and which test fixtures
cover it. If you change a calendar, change this file in the same commit.

## The pivot: Julian Day Number

All calendars convert from the **JDN of a UTC civil day**, an integer where 2000-01-01 is 2451545
(that day's noon is JD 2451545.0). The helpers are in `src/calendars/jdn.ts`:

- Gregorian and Julian conversions use the standard integer algorithms and are **proleptic**
  (Gregorian before 1582, Julian before 45 BCE) with astronomical year numbering (year 0 exists).
- A JDN maps to the Unix epoch by `unixDay = jdn - 2440588`.
- "Today" is the viewer's local calendar date, converted to a JDN. Everything else is UTC.

A calendar day boundary is treated as UTC midnight for every calendar, including those that begin
the day at sunset (Hebrew, Islamic) or sunrise. The date shown is the civil date, not the
liturgical day.

## Contract

```ts
interface Calendar {
  id;
  name;
  family;
  region;
  blurb;
  fromJDN(jdn): CalDate; // year, month, day, monthName, weekday?, label, extra?
  monthStarts(fromJdn, toJdn): MonthSpan[]; // contiguous bands [start, end) in JDN, for timeline lanes
}
```

`monthStarts` returns bands that tile the requested window: the first starts at or before
`fromJdn`, the last ends after `toJdn`, and each band's `start` equals the previous `end`. The
registry test in `tests/calendars.test.ts` enforces this for every calendar.

## The Intl adapter

`src/calendars/intl.ts` wraps `Intl.DateTimeFormat` with the `calendar` option. It formats the date
at 12:00 UTC of the JDN in the UTC zone (so the viewer's zone never matters), reads
`formatToParts`, memoises per JDN, and finds month starts by scanning for day-of-month 1. Each Intl
calendar is a small config (`calendar`, `minLen`, and a `describe` function that turns parts into a
`CalDate`). Accuracy for these calendars is whatever the platform's ICU data provides; the
test-suite pins a handful of well-known dates so a regression in the ICU data would show.

## Solar

### Gregorian (`gregorian.ts`)

Integer algorithm, proleptic. Leap years under the 4/100/400 rule. No known limits. Tests: JDN of
2000-01-01 and the Unix epoch, round trip over -500 to 3000.

### Julian (`julian.ts`)

Integer algorithm, proleptic. Offset from Gregorian is 13 days in 1900 to 2099. Tests: Julian
1582-10-04 is the day before Gregorian 1582-10-15; Julian 2026-09-26 is Gregorian 2026-10-09; Julian
0001-01-01 is JDN 1721424; round trip.

### ISO week date (`iso-week.ts`)

ISO 8601: Monday-start weeks, week 1 contains the year's first Thursday. In the CalDate, `month` is
the week number and `day` is the weekday 1 to 7, and timeline bands are weeks, not months. Tests:
2026-01-01 is 2026-W01-4, 2021-01-03 is 2020-W53-7, 2024-12-30 is 2025-W01-1.

### Holocene / Human Era (`holocene.ts`)

Gregorian plus 10000 years. Tests: 2000-01-01 is 12000 HE.

### Persian Solar Hijri (`persian.ts`, Intl `persian`)

Year starts at the March equinox (Nowruz). ICU uses an arithmetic leap rule that matches the observed
(Tehran meridian) calendar for the modern period; far from the present it may differ from the
astronomical definition by a day. Tests: Nowruz 2024-03-20 (1403), 2025-03-21 (1404), 2026-03-21
(1405).

### Indian national / Saka (`indian.ts`, Intl `indian`)

Official civil calendar from 1957, Saka era (year 1 is 78 CE). 1 Chaitra falls on 22 March, or 21
March in Gregorian leap years. Tests: 1 Chaitra 1946 is 2024-03-21, 1947 is 2025-03-22.

### Ethiopian (`ethiopian.ts`, Intl `ethiopic`)

Twelve 30-day months plus Pagume (5 or 6 days), leap day every 4th year, Amete Mihret era. Month
bands include the short Pagume. Tests: 1 Meskerem 2016 is 2023-09-12, 2017 is 2024-09-11.

### Coptic (`coptic.ts`, Intl `coptic`)

Same structure as Ethiopian with the Era of the Martyrs (284 CE). Tests: 1 Tout 1740 is 2023-09-12,
1741 is 2024-09-11.

### Egyptian civil (`egyptian.ts`)

Hand-implemented. 12 months of 30 days plus 5 epagomenal days, always 365 days, no leap day, so the
new year wanders through the seasons (about one day in four years). Epoch: 1 Thoth of Nabonassar
year 1 is 26 February 747 BCE (Julian), JDN 1448638. Years are numbered by the era of Nabonassar,
which is how Ptolemy used the calendar; it is a convention, not what Egyptians called their year.
Tests: epoch JDN, constant 365-day year length.

### French Republican (`french-republican.ts`)

Hand-implemented, **Romme rule**: year Y is a leap year when Y is divisible by 4, except century
years not divisible by 400. Epoch 1 Vendemiaire An I is 22 September 1792. 12 months of 30 days in
three 10-day decades (Primidi to Decadi), then 5 or 6 complementary days (Sansculottides).

Known limit: this is the arithmetic extrapolation used by calendar software, not the historical
calendar. Historically, leap years were years 3, 7 and 11 (set by observing the autumn equinox in
Paris) and the calendar was abolished at the end of year XIV (31 December 1805). The two rules disagree by one day, and only during years IV, VIII and XII: historically those
years began one day later than the Romme rule says (the historical leap day fell at the end of years
III, VII and XI instead of IV, VIII and XII). For example the Romme rule gives 19 Brumaire An VIII for
9 November 1799, which was historically 18 Brumaire. Every other year agrees. The UI labels the calendar "Romme rule" and flags dates outside years
1 to 14 as extended. Tests: 1 Vendemiaire An I is 1792-09-22, 1 Vendemiaire An XIV is 1805-09-23,
the leap rule, the documented Brumaire discrepancy.

### Thai Buddhist (`thai-buddhist.ts`, Intl `buddhist`)

Gregorian months and days, Buddhist Era = Gregorian + 543. Tests: 2025 is BE 2568.

### Japanese era (`japanese.ts`, Intl `japanese`)

Gregorian months and days with era-relative years. Reiwa began 2019-05-01; the first year is shown
as "gannen (1)". Before 1873 Japan used a lunisolar calendar; Intl maps eras onto Gregorian dates,
so older dates are era labels only. Tests: Reiwa on 2019-05-01, Heisei on 2019-04-30.

### ROC / Minguo (`roc.ts`, Intl `roc`)

Gregorian months and days, year = Gregorian - 1911. Tests: 2025 is year 114.

## Lunar

### Islamic, Umm al-Qura (`islamic-umalqura.ts`, Intl `islamic-umalqura`)

The Saudi table calendar. ICU's table covers roughly 1300 to 1600 AH (about 1882 to 2174 CE); outside
it ICU falls back to an arithmetic rule. Month starts here are the table values, which can differ
by a day from local moon sighting. Tests: 1 Muharram 1447 is 2025-06-26, 1 Ramadan 1446 is
2025-03-01.

### Islamic, tabular civil (`islamic-civil.ts`)

Hand-implemented arithmetic calendar: 30-year cycle with 11 leap years, odd months 30 days, even
months 29 days (last month 30 in leap years). Epoch (Friday civil epoch) 16 July 622 Julian, JDN 1948440. Differs from Umm al-Qura by 0 to 2 days. Tests: epoch conversion, and within one day of
Umm al-Qura for 1 Muharram 1447.

## Lunisolar

### Hebrew (`hebrew.ts`, Intl `hebrew`)

Fixed arithmetic calendar (Hillel II). Months follow the moon; a 13th month, Adar I, is inserted in 7
of every 19 years. Month numbers shown are the position in a leap year (Adar I is 6, Adar II is 7);
in a common year Adar is 6. Year starts at Tishri. Tests: Rosh Hashanah 2024-10-03 (5785),
2025-09-23 (5786), 2026-09-12 (5787).

### Chinese (`chinese.ts`, Intl `chinese`)

ICU computes new moons and solar terms astronomically for China Standard Time. A leap month is shown
as "Month N (leap)". The year number is the Gregorian year the lunar year begins in, and the extra
line gives the zodiac animal and the stem-branch name. Tests: Chinese New Year 2024-02-10 (Dragon),
2025-01-29, 2026-02-17 (Horse), all month 1 day 1.

### Korean Dangi (`dangi.ts`, Intl `dangi`)

Same method as Chinese but for the Korean meridian; differs in the occasional year when a new moon
or solar term falls near a midnight boundary. Test: 2025-01-29 is month 1 day 1.

## Day counts

### Maya (`maya.ts`)

Hand-implemented. Long Count (baktun.katun.tun.winal.kin) as days since the epoch, with the
Tzolk'in (260-day: 13 numbers x 20 names) and Haab' (365-day: 18 months of 20 days plus 5-day
Wayeb'). Correlation: the GMT correlation constant 584283, so 0.0.0.0.0 is JDN 584283. Other
correlations (e.g. 584285) shift every date by their difference. Timeline bands are Haab' months.
The CalDate `year` is the tun count and `month`/`day` come from the Haab'. Tests: 13.0.0.0.0 is
2012-12-21 (4 Ajaw 3 K'ank'in), 0.0.0.0.0 is 4 Ajaw 8 Kumk'u.

### Julian Day Number and Unix time (`day-counts.ts`)

Both are plain integer counts. The JDN lane shows the UTC civil day's JDN; the Unix lane shows
seconds at 00:00 UTC of the day (leap seconds ignored, as Unix time does). Timeline bands are 100
days (JDN) and 10 days (Unix) so the lanes have visible structure. Tests: JDN of 2000-01-01 is
2,451,545, Unix 86,400 s on 1970-01-02, 946,684,800 s on 2000-01-01.

## Invented

### Orrery (`orrery.ts`, `orrery-config.ts`)

See [ORRERY_CALENDAR.md](ORRERY_CALENDAR.md) for the specification. Tests are in
`tests/orrery.test.ts`: year lengths 2001 to 2100 are all 365 or 366, every year begins on the UTC
day of the December solstice, 12 x 30 + short month, 10-day weeks locked to months, 6 workdays and
4 days off per week, 216 workdays in every year.

## Registry test

`tests/calendars.test.ts` also runs a contract check on every registered calendar: unique ids, bands
that tile a full year window, `fromJDN(start).monthName` equals the band label, and no `undefined` or
`NaN` in a label.

## Adding a calendar

1. Create `src/calendars/<name>.ts` exporting a `Calendar` (use `intlCalendar` or `scanSpans` to save
   work).
2. Register it in `src/calendars/index.ts`.
3. Add fixtures to `tests/calendars.test.ts` from a published source, and the registry test will
   pick it up automatically.
4. Document it here, and bump the count in the registry test.
