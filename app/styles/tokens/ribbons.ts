/**
 * The award ribbons on a profile, exactly as the site drew them before the
 * redesign: each badge its own emoji and colour. They are kept as they were
 * on purpose, so they sit outside the token palette and the no-emoji rule.
 *
 * The colours are Tailwind's v3 palette, which the redesign's config no
 * longer includes. `wash` is the ribbon behind the text: a 60% wash of the
 * colour's darkest step for most, the metal itself for the two gold titles.
 */
export type Ribbon = {
  emoji: string;
  /** The rule along the top. */
  edge: string;
  /** The stars. */
  star: string;
  wash: string;
  /**
   * The ribbon in the light theme. The old site was dark only, and a 60%
   * wash over a light card left the light name unreadable, so the light
   * theme gets the same colour solid.
   */
  solid: string;
  /** The name: dark on the two gold ribbons, light on the rest. */
  label: string;
};

/** A 60% wash, as the old `bg-*-950/60`. */
const wash = (hex: string) => `${hex}99`;

const LIGHT_LABEL = '#cbd5e1';
const DARK_LABEL = '#451a03';

const ribbon = (
  emoji: string,
  edge: string,
  star: string,
  darkest: string,
): Ribbon => ({
  emoji,
  edge,
  star,
  wash: wash(darkest),
  solid: darkest,
  label: LIGHT_LABEL,
});

/** Keyed by badge key. */
export const RIBBONS: Record<string, Ribbon> = {
  'champion-of-champions': {
    emoji: '👑',
    edge: '#d97706',
    star: '#92400e',
    wash: '#fcd34d',
    solid: '#fcd34d',
    label: DARK_LABEL,
  },
  'league-champion': {
    emoji: '🏆',
    edge: '#f59e0b',
    star: '#b45309',
    wash: '#fde68a',
    solid: '#fde68a',
    label: DARK_LABEL,
  },
  'cup-champion': ribbon('🥇', '#38bdf8', '#7dd3fc', '#082f49'),
  sacko: ribbon('💩', '#a06a40', '#a06a40', '#451a03'),
  'champions-league': ribbon('🛡️', '#a78bfa', '#c4b5fd', '#2e1065'),
  seasons: ribbon('📅', '#60a5fa', '#93c5fd', '#172554'),
  'high-scoring-week': ribbon('💥', '#fb7185', '#fda4af', '#4c0519'),
  'win-streak': ribbon('🔥', '#ef4444', '#f87171', '#450a0a'),
  'd12-champion': ribbon('🎯', '#34d399', '#6ee7b7', '#022c22'),
  'qbStreaming-champion': ribbon('🏈', '#22d3ee', '#67e8f9', '#083344'),
  'spreadPool-champion': ribbon('💰', '#4ade80', '#86efac', '#052e16'),
  'locks-champion': ribbon('🔒', '#818cf8', '#a5b4fc', '#1e1b4b'),
  'dfsSurvivor-champion': ribbon('👥', '#a3e635', '#bef264', '#1a2e05'),
  'guillotine-champion': ribbon('🪓', '#f472b6', '#f9a8d4', '#500724'),
  'bestBall-champion': ribbon('🤖', '#2dd4bf', '#5eead4', '#042f2e'),
  'survivor-champion': ribbon('🏝️', '#fde047', '#fef08a', '#422006'),
  'fSquared-champion': ribbon('🧮', '#e879f9', '#f0abfc', '#4a044e'),
};
