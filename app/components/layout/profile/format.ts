/**
 * How every profile tab writes its numbers and dates, so the same thing reads
 * the same on each tab.
 */

/** A score to a fixed number of places, or a dash when there is none. */
export const pts = (value: number | null | undefined, digits = 2) =>
  value === null || value === undefined ? '—' : value.toFixed(digits);

/** "+2.10", "−1.35", "0.00" - a proper minus, so a column of them lines up. */
export const signed = (value: number, digits = 0) =>
  value > 0
    ? `+${value.toFixed(digits)}`
    : value < 0
    ? `−${(-value).toFixed(digits)}`
    : (0).toFixed(digits);

/** A share from 0 to 1 as a percentage, or a dash when there is none. */
export const pct = (value: number | null | undefined, digits = 0) =>
  value === null || value === undefined
    ? '—'
    : `${(value * 100).toFixed(digits)}%`;

export const plural = (count: number, noun: string) =>
  `${count} ${noun}${count === 1 ? '' : 's'}`;

export const ordinal = (rank: number) => {
  const tens = rank % 100;
  if (tens >= 11 && tens <= 13) return `${rank}th`;
  return `${rank}${['th', 'st', 'nd', 'rd'][rank % 10] ?? 'th'}`;
};

/**
 * "2024, week 3" - a week inside a sentence or a stat's small print. A week
 * standing on its own, like a table cell, is written "Week 3".
 */
export const weekLabel = (week: { year: number; week: number }) =>
  `${week.year}, week ${week.week}`;

/** The line as a bettor reads it: "−3", "+6.5", "PK". */
export const line = (spread: number) =>
  spread === 0 ? 'PK' : signed(spread, spread % 1 === 0 ? 0 : 1);
