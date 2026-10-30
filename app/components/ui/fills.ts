import { isLeagueName } from '~/utils/constants';

/**
 * Every colour that can be a fill, by token name. Category colours are
 * fills, never text: text on them is their own foreground, and an edge
 * outlines the few too faint for their ground.
 *
 * Written out whole, because Tailwind only builds classes it finds in the
 * source.
 */
export const FILLS = {
  'league-admiral':
    'bg-league-admiral text-league-admiral-foreground border-league-admiral-edge',
  'league-champions':
    'bg-league-champions text-league-champions-foreground border-league-champions-edge',
  'league-dragon':
    'bg-league-dragon text-league-dragon-foreground border-league-dragon-edge',
  'league-galaxy':
    'bg-league-galaxy text-league-galaxy-foreground border-league-galaxy-edge',
  'league-monarch':
    'bg-league-monarch text-league-monarch-foreground border-league-monarch-edge',
  'position-qb':
    'bg-position-qb text-position-qb-foreground border-position-qb-edge',
  'position-rb':
    'bg-position-rb text-position-rb-foreground border-position-rb-edge',
  'position-wr':
    'bg-position-wr text-position-wr-foreground border-position-wr-edge',
  'position-te':
    'bg-position-te text-position-te-foreground border-position-te-edge',
  'position-def':
    'bg-position-def text-position-def-foreground border-position-def-edge',
  'medal-gold':
    'bg-medal-gold text-medal-gold-foreground border-medal-gold-edge',
  'medal-silver':
    'bg-medal-silver text-medal-silver-foreground border-medal-silver-edge',
  'medal-bronze':
    'bg-medal-bronze text-medal-bronze-foreground border-medal-bronze-edge',
  'medal-sacko':
    'bg-medal-sacko text-medal-sacko-foreground border-medal-sacko-edge',
  // Sequence steps sit against each other rather than the ground, so they
  // have no edge of their own; the border matches the fill.
  'sequence-1': 'bg-sequence-1 text-sequence-1-foreground border-sequence-1',
  'sequence-2': 'bg-sequence-2 text-sequence-2-foreground border-sequence-2',
  'sequence-3': 'bg-sequence-3 text-sequence-3-foreground border-sequence-3',
  'sequence-4': 'bg-sequence-4 text-sequence-4-foreground border-sequence-4',
  'sequence-5': 'bg-sequence-5 text-sequence-5-foreground border-sequence-5',
  'sequence-6': 'bg-sequence-6 text-sequence-6-foreground border-sequence-6',
  'sequence-7': 'bg-sequence-7 text-sequence-7-foreground border-sequence-7',
  primary: 'bg-primary text-primary-foreground border-primary-edge',
} as const;

export type Fill = keyof typeof FILLS;

export type LeagueFill = Extract<Fill, `league-${string}`>;
export type PositionFill = Extract<Fill, `position-${string}`>;

/** A league's fill from its name in any case, or none for one we do not know. */
export const leagueFill = (name: string): LeagueFill | null => {
  const key = name.toLowerCase();
  return isLeagueName(key) ? `league-${key}` : null;
};

const POSITIONS = ['qb', 'rb', 'wr', 'te', 'def'];

/** A position's fill from QB, rb, Def and so on, or none for K and the like. */
export const positionFill = (
  position: string | null | undefined,
): PositionFill | null => {
  const key = position?.toLowerCase() ?? '';
  return POSITIONS.includes(key) ? (`position-${key}` as PositionFill) : null;
};

/**
 * The value sequence, darkest first, so ordered data (a tier, a band) can
 * step through it.
 */
export const SEQUENCE: Fill[] = [
  'sequence-1',
  'sequence-2',
  'sequence-3',
  'sequence-4',
  'sequence-5',
  'sequence-6',
  'sequence-7',
];

/**
 * Each position's colour faded to a tint, for a large area like a draft
 * board cell, where the full fill would drown out the text on it. How faded
 * is a depth token. Text on a tint is the foreground, not the fill's own.
 */
const POSITION_TINTS: Record<PositionFill, string> = {
  'position-qb': 'bg-position-qb/[var(--position-tint)]',
  'position-rb': 'bg-position-rb/[var(--position-tint)]',
  'position-wr': 'bg-position-wr/[var(--position-tint)]',
  'position-te': 'bg-position-te/[var(--position-tint)]',
  'position-def': 'bg-position-def/[var(--position-tint)]',
};

/** A position's tint, or the secondary surface for K and the like. */
export const positionTint = (position: string | null | undefined): string => {
  const fill = positionFill(position);
  return fill ? POSITION_TINTS[fill] : 'bg-secondary';
};
