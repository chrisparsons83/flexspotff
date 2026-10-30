import type { Tone } from '~/components/ui/bars';

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
  good: 'text-positive',
  bad: 'text-negative',
  neutral: 'text-muted-foreground',
  /** Gold is a fill, never text; a champion is set in weight, beside its gold square. */
  champion: 'font-semibold text-foreground',
  /** The sacko's fill is too dark for text; this is its text-safe stand-in. */
  sacko: 'text-warning',
  /** Something still being played. */
  live: 'text-warning',
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
export const BAR: Record<'win' | 'tie' | 'loss', Tone> = {
  win: 'positive',
  tie: 'neutral',
  loss: 'negative',
};

/**
 * A word of status in a row - "Won", "Contrarian" - by what it means. Plain
 * text in each state's text-safe colour, never a chip: the word says it, the
 * colour repeats it.
 */
export const STATUS = {
  win: 'text-positive',
  loss: 'text-negative',
  neutral: 'text-muted-foreground',
  /** Worth a second look: a playoff game, an empty slot. */
  highlight: 'text-warning',
  /** Going against the grain: a contrarian pick, a doubled-up QB. */
  accent: 'text-brand',
} as const;

export type StatusTone = keyof typeof STATUS;
