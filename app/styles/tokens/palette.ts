/**
 * The colour system, built by rule rather than picked by hand (see #191).
 *
 * - Neutrals are equal lightness steps with no hue. Each theme's roles are
 *   fixed offsets from its ground, so light is dark read from the other end.
 * - The five league colours are fixed: they are also Discord role and embed
 *   colours, so they come from LEAGUE_EMBED_COLORS unchanged.
 * - Every other categorical colour is placed at the midpoint of the largest
 *   hue gap left on the wheel, at the leagues' average chroma.
 * - Ordered data uses a value sequence: one hue stepping in lightness.
 * - Categorical colours are fills, never text. Text on a fill is pure black
 *   or pure white, whichever reads better.
 * - A category fill too faint to see on the ground gets a thin neutral edge.
 */
import { LEAGUE_EMBED_COLORS, Leagues } from '../../utils/constants';
import { contrast, hexToOklch, type Oklch, toGamut } from './color';

export type Theme = 'dark' | 'light';
export const THEMES: Theme[] = ['dark', 'light'];

/** WCAG AA for body text, and for graphics and UI component edges. */
export const TEXT_CONTRAST = 4.5;
export const FILL_CONTRAST = 3;

// Neutrals

const NEUTRAL_DARKEST = 0.18;
const NEUTRAL_LIGHTEST = 0.97;
const NEUTRAL_STEP_COUNT = 21;

export const neutralSteps: Oklch[] = Array.from(
  { length: NEUTRAL_STEP_COUNT },
  (_, i) => ({
    l:
      NEUTRAL_DARKEST +
      (i * (NEUTRAL_LIGHTEST - NEUTRAL_DARKEST)) / (NEUTRAL_STEP_COUNT - 1),
    c: 0,
    h: 0,
  }),
);

const BLACK: Oklch = { l: 0, c: 0, h: 0 };
const WHITE: Oklch = { l: 1, c: 0, h: 0 };

/** Pure black or pure white, whichever contrasts more with the fill. */
export const textOn = (fill: Oklch) =>
  contrast(fill, BLACK) >= contrast(fill, WHITE) ? BLACK : WHITE;

// Leagues (fixed)

const leagueNames = Object.values(Leagues);

export const leagues = Object.fromEntries(
  leagueNames.map(name => [
    name,
    hexToOklch(LEAGUE_EMBED_COLORS[name].toString(16).padStart(6, '0')),
  ]),
) as Record<Leagues, Oklch>;

const leagueColors = Object.values(leagues);
const mean = (values: number[]) =>
  values.reduce((sum, v) => sum + v, 0) / values.length;

/** Every generated categorical colour shares the leagues' average chroma. */
export const CATEGORY_CHROMA = mean(leagueColors.map(c => c.c));

/**
 * Adds `count` hues, each at the midpoint of the widest gap left between the
 * hues already on the wheel. Returned in the order they were placed.
 */
export const fillHueGaps = (taken: number[], count: number) => {
  const hues = [...taken].sort((a, b) => a - b);
  const placed: number[] = [];
  for (let n = 0; n < count; n++) {
    let widest = -1;
    let start = 0;
    hues.forEach((hue, i) => {
      const next = i + 1 < hues.length ? hues[i + 1] : hues[0] + 360;
      if (next - hue > widest) {
        widest = next - hue;
        start = hue;
      }
    });
    const hue = (start + widest / 2) % 360;
    placed.push(hue);
    hues.push(hue);
    hues.sort((a, b) => a - b);
  }
  return placed;
};

/**
 * The lightest value at which every hue clears FILL_CONTRAST on the light
 * ground. Generated colours can meet that bar in both themes; the fixed
 * league colours cannot, which is why they are listed as exceptions.
 */
const categoryLightness = (hues: number[]) => {
  const lightGround = neutralSteps[NEUTRAL_STEP_COUNT - 1];
  for (let l = mean(leagueColors.map(c => c.l)); l > 0; l -= 0.005) {
    const colors = hues.map(h => toGamut({ l, c: CATEGORY_CHROMA, h }));
    if (colors.every(c => contrast(c, lightGround) >= FILL_CONTRAST)) return l;
  }
  throw new Error('No lightness clears the light ground');
};

// Positions

export type Position = 'qb' | 'rb' | 'wr' | 'te' | 'def';

/**
 * Positions in the order their hues are placed. The order is chosen so each
 * lands near its current colour: DEF red-brown, WR blue, QB maroon, TE
 * orange, RB green.
 */
const POSITION_ORDER: Position[] = ['def', 'wr', 'qb', 'te', 'rb'];

const positionHues = fillHueGaps(
  leagueColors.map(c => c.h),
  POSITION_ORDER.length,
);
const positionLightness = categoryLightness(positionHues);

export const positions = Object.fromEntries(
  POSITION_ORDER.map((name, i) => [
    name,
    toGamut({ l: positionLightness, c: CATEGORY_CHROMA, h: positionHues[i] }),
  ]),
) as Record<Position, Oklch>;

// Medals

export type Medal = 'gold' | 'silver' | 'bronze' | 'sacko';

/**
 * A descending lightness sequence. Gold and bronze carry the category chroma,
 * silver none, and the sacko half, so it reads as brown rather than bronze.
 */
const MEDAL_TOP = 0.8;
const MEDAL_STEP = 0.08;
const MEDAL_SPEC: Record<Medal, { c: number; h: number }> = {
  gold: { c: CATEGORY_CHROMA, h: 90 },
  silver: { c: 0, h: 0 },
  bronze: { c: CATEGORY_CHROMA, h: 55 },
  sacko: { c: CATEGORY_CHROMA / 2, h: 55 },
};

export const medals = Object.fromEntries(
  (Object.keys(MEDAL_SPEC) as Medal[]).map((name, i) => [
    name,
    toGamut({ l: MEDAL_TOP - i * MEDAL_STEP, ...MEDAL_SPEC[name] }),
  ]),
) as Record<Medal, Oklch>;

// Value sequence for ordered data (ranks, percentiles)

const SEQUENCE_HUE = leagues.galaxy.h;
const SEQUENCE_DARKEST = 0.4;
const SEQUENCE_LIGHTEST = 0.88;
const SEQUENCE_STEP_COUNT = 7;

export const sequence: Oklch[] = Array.from(
  { length: SEQUENCE_STEP_COUNT },
  (_, i) =>
    toGamut({
      l:
        SEQUENCE_DARKEST +
        (i * (SEQUENCE_LIGHTEST - SEQUENCE_DARKEST)) /
          (SEQUENCE_STEP_COUNT - 1),
      c: CATEGORY_CHROMA,
      h: SEQUENCE_HUE,
    }),
);

// Theme roles

/** Steps from the ground for each layer; light mode counts from the top. */
const SURFACE_OFFSET = 2;
const RAISED_OFFSET = 4;
const BORDER_OFFSET = 6;

const SEMANTIC_HUES = {
  negative: 25,
  warning: 85,
  positive: 145,
  info: 250,
} as const;

/**
 * The semantic colour at the given hue whose lightness is closest to the
 * ground while still reading as text on every surface.
 */
const semanticText = (h: number, theme: Theme, against: Oklch) => {
  const direction = theme === 'dark' ? 1 : -1;
  for (
    let l = theme === 'dark' ? 0.4 : 0.8;
    l > 0 && l < 1;
    l += direction * 0.005
  ) {
    const color = toGamut({ l, c: CATEGORY_CHROMA, h });
    if (contrast(color, against) >= TEXT_CONTRAST) return color;
  }
  throw new Error(`No ${theme} text colour at hue ${h}`);
};

export const themeRoles = (theme: Theme) => {
  const step = (offset: number) =>
    neutralSteps[theme === 'dark' ? offset : NEUTRAL_STEP_COUNT - 1 - offset];

  const background = step(0);
  const surface = step(SURFACE_OFFSET);
  const raised = step(RAISED_OFFSET);
  const foreground = step(NEUTRAL_STEP_COUNT - 1);

  /** The first step away from the ground that clears `ratio` on `against`. */
  const firstStepClearing = (ratio: number, against: Oklch) => {
    for (let offset = 0; offset < NEUTRAL_STEP_COUNT; offset++) {
      if (contrast(step(offset), against) >= ratio) return step(offset);
    }
    throw new Error(`No ${theme} step clears ${ratio}`);
  };

  const semantic = Object.fromEntries(
    Object.entries(SEMANTIC_HUES).map(([name, h]) => [
      name,
      semanticText(h, theme, raised),
    ]),
  ) as Record<keyof typeof SEMANTIC_HUES, Oklch>;

  return {
    background,
    foreground,
    card: surface,
    'card-foreground': foreground,
    popover: surface,
    'popover-foreground': foreground,
    primary: foreground,
    'primary-foreground': background,
    secondary: raised,
    'secondary-foreground': foreground,
    muted: surface,
    'muted-foreground': firstStepClearing(TEXT_CONTRAST, raised),
    accent: raised,
    'accent-foreground': foreground,
    destructive: semantic.negative,
    'destructive-foreground': textOn(semantic.negative),
    border: step(BORDER_OFFSET),
    input: firstStepClearing(FILL_CONTRAST, raised),
    ring: foreground,
    ...semantic,
  };
};

export type Role = keyof ReturnType<typeof themeRoles>;

/**
 * Pairs the contrast test checks in each theme. Text pairs need
 * TEXT_CONTRAST; edges of controls need FILL_CONTRAST.
 */
export const TEXT_PAIRS: [Role, Role][] = [
  ['foreground', 'background'],
  ['foreground', 'card'],
  ['foreground', 'secondary'],
  ['card-foreground', 'card'],
  ['popover-foreground', 'popover'],
  ['primary-foreground', 'primary'],
  ['secondary-foreground', 'secondary'],
  ['accent-foreground', 'accent'],
  ['muted-foreground', 'background'],
  ['muted-foreground', 'muted'],
  ['muted-foreground', 'secondary'],
  ['destructive-foreground', 'destructive'],
  ...(['negative', 'warning', 'positive', 'info'] as const).flatMap(
    (role): [Role, Role][] => [
      [role, 'background'],
      [role, 'card'],
      [role, 'secondary'],
    ],
  ),
];

export const EDGE_PAIRS: [Role, Role][] = [
  ['input', 'background'],
  ['input', 'card'],
  ['ring', 'background'],
  ['ring', 'card'],
];

/** Fills that name a category, keyed by token name. */
export const categoryFills: Record<string, Oklch> = {
  ...Object.fromEntries(
    Object.entries(leagues).map(([name, c]) => [`league-${name}`, c]),
  ),
  ...Object.fromEntries(
    Object.entries(positions).map(([name, c]) => [`position-${name}`, c]),
  ),
  ...Object.fromEntries(
    Object.entries(medals).map(([name, c]) => [`medal-${name}`, c]),
  ),
};

/**
 * Every fill, keyed by token name. Sequence steps are read against each
 * other, not against the ground, so they are not category fills.
 */
export const fills: Record<string, Oklch> = {
  ...categoryFills,
  ...Object.fromEntries(sequence.map((c, i) => [`sequence-${i + 1}`, c])),
};

/**
 * The edge drawn around each category fill. Where the fill clears
 * FILL_CONTRAST on the ground the edge is the fill itself, so it disappears;
 * where it does not (the lightest fills on the light ground) the edge is the
 * input step. Every fill always has an edge, so nothing shifts between themes.
 */
export const fillEdges = (theme: Theme) => {
  const { background, input } = themeRoles(theme);
  return Object.fromEntries(
    Object.entries(categoryFills).map(([name, fill]) => [
      `${name}-edge`,
      contrast(fill, background) >= FILL_CONTRAST ? fill : input,
    ]),
  );
};
