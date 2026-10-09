/**
 * Every design choice of the Orrery calendar lives here. Change a value and the
 * calendar, the views and the computed figures follow. See docs/ORRERY_CALENDAR.md
 * for the reasoning behind each choice.
 */

export const ORRERY_CONFIG = {
  /**
   * Reference meridian. The civil day containing the December solstice is the
   * UTC day, i.e. the Greenwich day. A different zone would need orrery.ts to
   * shift the instant before taking its day.
   */
  REFERENCE_MERIDIAN: 'UTC (Greenwich)',

  /**
   * Orrery year N begins at the December solstice of Gregorian year
   * (N - YEAR_NUMBER_OFFSET). With 1, Orrery year 2027 begins in December 2026.
   */
  YEAR_NUMBER_OFFSET: 1,

  /** Regular months per year, each DAYS_PER_MONTH long. */
  REGULAR_MONTHS: 12,
  DAYS_PER_MONTH: 30,

  /** Days in a week. A week never crosses a month boundary (3 weeks per month). */
  WEEK_LENGTH: 10,

  /** Days 1..WORKDAYS_PER_WEEK of each week are workdays, the rest are days off. */
  WORKDAYS_PER_WEEK: 6,

  /**
   * ADJUSTABLE CHOICE: whether every day of the short year-end month is a day off.
   * Set to false to make days 1..WORKDAYS_PER_WEEK of the short month workdays.
   */
  FESTIVAL_ALL_OFF: true,

  /** PLACEHOLDER NAMES: rename these freely; nothing else depends on the text. */
  MONTH_NAMES: [
    'Month 1',
    'Month 2',
    'Month 3',
    'Month 4',
    'Month 5',
    'Month 6',
    'Month 7',
    'Month 8',
    'Month 9',
    'Month 10',
    'Month 11',
    'Month 12',
  ] as readonly string[],
  FESTIVAL_NAME: 'Festival',
  WEEKDAY_NAMES: [
    'Day 1',
    'Day 2',
    'Day 3',
    'Day 4',
    'Day 5',
    'Day 6',
    'Day 7',
    'Day 8',
    'Day 9',
    'Day 10',
  ] as readonly string[],
};

/** Days in the twelve regular months. */
export const REGULAR_DAYS = ORRERY_CONFIG.REGULAR_MONTHS * ORRERY_CONFIG.DAYS_PER_MONTH;
