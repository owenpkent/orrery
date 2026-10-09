# The Orrery calendar

An invented calendar anchored to the sky. This file is the specification; the code is
`src/calendars/orrery.ts` and every adjustable choice is in `src/calendars/orrery-config.ts`.

## Rules

1. A year has **12 months of 30 days**, followed by a **13th short month** of **5 days, or 6 days in a
   leap year**.
2. A **week is 10 days** and is **locked to months**: each 30-day month holds exactly 3 weeks, so a
   given date always falls on the same weekday, every year.
3. In each week, **days 1 to 6 are workdays** and **days 7 to 10 are days off**.
4. The **short month is a year-end festival and every day of it is a day off.** This is an adjustable
   choice (`FESTIVAL_ALL_OFF` in the config). The short month has no weeks; its days are numbered 1
   to 5 (or 6) and carry weekday numbers 1 to 5 (or 6).
5. **The year begins on the real December solstice.** New Year's Day is the UTC civil day that
   contains the instant of the December solstice, computed by astronomy-engine (`Seasons`).
6. **Leap years are not a rule, they fall out of the sky.** The year length is the number of days from
   this solstice day to the next solstice day (always 365 or 366). The short month absorbs the
   difference: its length is `year length - 360`.
7. **Reference meridian is UTC (Greenwich).** The constant is `REFERENCE_MERIDIAN` in the config
   (documentation only; the code uses the UTC day).
8. **Year numbering:** Orrery year N begins at the December solstice of Gregorian year `N - 1`. The
   constant is `YEAR_NUMBER_OFFSET = 1`. So Orrery 2027 begins on 21 December 2026 and mostly overlaps
   Gregorian 2027.
9. **Names are placeholders.** `MONTH_NAMES` ("Month 1" to "Month 12"), `FESTIVAL_NAME`
   ("Festival") and `WEEKDAY_NAMES` ("Day 1" to "Day 10") in the config are there to be renamed.
   Nothing else depends on the text.

## Date arithmetic

Let `S(N)` be the JDN of New Year's Day of Orrery year N. For a day `j` in year N, `d = j - S(N)` is
the 0-based day of the year.

| d                      | month               | day in month   | week                        | weekday number         |
| ---------------------- | ------------------- | -------------- | --------------------------- | ---------------------- |
| 0 to 359               | `floor(d / 30) + 1` | `d mod 30 + 1` | `floor((day - 1) / 10) + 1` | `(day - 1) mod 10 + 1` |
| 360 to year length - 1 | 13 (Festival)       | `d - 359`      | none                        | the day number         |

A day is a workday when `weekday number <= WORKDAYS_PER_WEEK` and it is not in the festival (with
`FESTIVAL_ALL_OFF` true).

## Why the year length is always 365 or 366

The interval between successive December solstices is about 365.2424 days and varies by only
minutes from year to year. Counting UTC civil days from solstice day to solstice day therefore gives
365 or 366. `tests/orrery.test.ts` checks every year from 2001 to 2100. Over that century 24 of the
100 years have 366 days (average length 365.24), and the gaps between long years are 4 or 5 years.
The December solstice fell on 20 December in 5 of those years, 21 December in 82, and 22 December in 13.

Because the year is defined by the sky, the calendar can never drift against the seasons. The cost is
that year lengths are not predictable by a short rule: they are computed (astronomy-engine, with
sub-minute accuracy for modern dates). A solstice that falls very close to 00:00 UTC could, in principle, land on either side of midnight
depending on the ephemeris. The closest case from 2000 to 2100 is the December 2043 solstice, about 1.5
minutes from midnight UTC, which is comfortably outside the engine's error (well under a minute)
but worth knowing about.

## Workdays compared with a Gregorian 5/2 week

Computed by the code, not estimated (`orreryYearStats` and a count of Monday to Friday over the same
years):

|                                 | Orrery                  | Gregorian Monday to Friday            |
| ------------------------------- | ----------------------- | ------------------------------------- |
| Workdays per year               | 216 (every year)        | 260 to 262, mean 260.9 (2001 to 2100) |
| Days off per year               | 149 or 150, mean 149.24 | 103 to 105, mean 104.4                |
| Share of days that are workdays | 59.1%                   | 71.4%                                 |
| Rhythm                          | 6 on, 4 off             | 5 on, 2 off                           |
| Weekday of a date               | never changes           | shifts every year                     |

So the Orrery week has 44.9 fewer working days a year than the 5/2 week (17% fewer), and about 45
more days off. The longest rest is at year end: days 7 to 10 of the last week of month 12 (4 days)
plus the whole festival (5 or 6 days), which is 9 or 10 consecutive days off. Every other rest is 4
days. If a calendar with a lighter off-share is wanted, change `WORKDAYS_PER_WEEK` (the tests that
assume 216 workdays then need updating) or set `FESTIVAL_ALL_OFF` to false.

## Comparison with the French Republican calendar

The Orrery calendar is closest to the French Republican calendar (1793 to 1805):

|                | French Republican                                                                | Orrery                                    |
| -------------- | -------------------------------------------------------------------------------- | ----------------------------------------- |
| Months         | 12 x 30 days                                                                     | 12 x 30 days                              |
| Week           | 10 days (décade), 3 per month, locked to months                                  | 10 days, 3 per month, locked to months    |
| Rest days      | 1 per décade (Décadi), 36 a year, plus complementary days                        | 4 per week, 144 a year, plus the festival |
| Year-end block | 5 or 6 "complementary days" (Sansculottides)                                     | 5 or 6 day festival month                 |
| Year start     | Autumn equinox at Paris (observed)                                               | December solstice, UTC day                |
| Leap years     | Observed originally (years 3, 7, 11); the Romme rule is an arithmetic substitute | Fall out of the solstice dates, no rule   |
| Month names    | Seasonal nature names                                                            | Placeholders                              |

Shared idea: a decimal week that never changes alignment with the month, so a date implies its
weekday. Differences: the French calendar spent 1 day in 10 resting and met strong resistance; the
Orrery calendar rests 4 days in 10. The French year start was tied to the equinox as seen from Paris,
the Orrery year to the solstice day on the Greenwich meridian.

## Comparison with the Egyptian civil calendar

The Egyptian civil year has 12 months of 30 days plus 5 **epagomenal days** at the end, always 365
days with no leap day. The Orrery short month plays the same role as the epagomenal days (a block of
5 outside the months), with two differences: it sometimes has a sixth day, and that sixth day is what
keeps the calendar locked to the solstice, whereas the Egyptian calendar drifts by about a day every
four years against the seasons. Egyptian months were divided into three 10-day decans, which is also
the same shape as the Orrery months of three weeks.

## Implementation notes

- `orreryYearStart(N)` is `jdnFromMs(decemberSolstice(N - YEAR_NUMBER_OFFSET))`, cached.
- `orreryDate(jdn)` finds the year by starting from the Gregorian year plus the offset and adjusting
  by at most one.
- `monthStarts(from, to)` returns month bands directly from year starts, including the short month,
  so it always tiles the window.
- The Orrery lane in the timeline view draws heavy lines at each year start, which line up with the
  December solstice marker; this is the quickest way to see the design working.
