/**
 * What each colour means on a profile, written down once so every tab uses
 * the same one for the same thing.
 *
 * Good is green and bad is red, as sport has it, but colour is never the only
 * thing that says which: a signed number carries its sign, a result its
 * letter or word, a bar its length. Roughly one man in twelve cannot tell
 * these two hues apart, so the colour only ever repeats what is already
 * written.
 */

/** Text that says how something went. */
export const TEXT = {
  good: 'text-emerald-300',
  bad: 'text-rose-300',
  neutral: 'text-slate-400',
  champion: 'text-gold',
  /** Lighter than the sacko's own brown, which is too dark to read as text. */
  sacko: 'text-brown-light',
  /** Something still being played. */
  live: 'text-amber-200',
} as const;

/** Green above zero, red below, grey at nothing. */
export const signedTone = (value: number | null | undefined) =>
  value === null || value === undefined || value === 0
    ? TEXT.neutral
    : value > 0
    ? TEXT.good
    : TEXT.bad;

/** A game's result letter. The letter itself says which; this only repeats it. */
export const RESULT_TEXT = {
  W: TEXT.good,
  L: TEXT.bad,
  T: TEXT.neutral,
} as const;

/** Segments of a bar that splits wins from losses. */
export const BAR = {
  win: 'bg-emerald-400',
  tie: 'bg-slate-400',
  loss: 'bg-rose-400',
} as const;

/** The small rounded labels beside a row, by what they mean. */
export const TAG = {
  win: 'bg-emerald-400/15 text-emerald-200',
  loss: 'bg-rose-400/15 text-rose-200',
  neutral: 'bg-slate-600/40 text-slate-300',
  /** The season still being played. */
  current: 'bg-sky-400/15 text-sky-200',
  /** Worth a second look: a playoff game, an empty slot. */
  highlight: 'bg-amber-400/15 text-amber-200',
  /** Going against the grain: a contrarian pick, a doubled-up QB. */
  accent: 'bg-violet-400/15 text-violet-200',
} as const;

export type TagTone = keyof typeof TAG;
