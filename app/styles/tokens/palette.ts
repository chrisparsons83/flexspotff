/**
 * The colour system, built by rule rather than picked by hand (see #191).
 *
 * - Neutrals are equal lightness steps of grey with a faint slate-blue
 *   tinge, dark and cool like the reference sites in #220. The tinge fades toward the light end. Each
 *   theme's roles are fixed offsets from its ground, so light is dark read
 *   from the other end.
 * - One vivid accent, the orange of the logo, marks buttons, links and the
 *   current page. Like the league colours it is fixed: one colour in both
 *   themes, so the logo and the buttons always match.
 * - Buttons sit on a short drop shadow in a darker shade of the accent, like
 *   a key, and press down into it.
 * - Each league has a tint: its hue, at low chroma, at card lightness. A
 *   league's panels and pages wear it as a field; text sits on it as on a
 *   card.
 * - The five league colours are fixed: they are also Discord role and embed
 *   colours, so they come from LEAGUE_EMBED_COLORS unchanged.
 * - Position colours keep Sleeper's hues, at the leagues' average chroma,
 *   so they match the draft board. DEF is Sleeper's brown exactly.
 * - Ordered data uses a value sequence: one hue stepping in lightness.
 * - Categorical colours are fills, never text. Text on a fill is pure black
 *   or pure white, whichever reads better.
 * - Category fills sit on the ground or a card, never on the secondary
 *   surface, which is for controls. A fill too faint to see on either gets a
 *   thin neutral edge.
 * - Every colour is rounded as it is made, so what the tests check is exactly
 *   what tokens.css ships.
 */
import { LEAGUE_EMBED_COLORS, Leagues } from '../../utils/constants';
import { contrast, hexToOklch, type Oklch, round, toGamut } from './color';

export type Theme = 'dark' | 'light';
export const THEMES: Theme[] = ['dark', 'light'];

/** WCAG AA for body text, and for graphics and UI component edges. */
export const TEXT_CONTRAST = 4.5;
export const FILL_CONTRAST = 3;

/** In gamut, at the precision written to CSS. */
const make = (color: Oklch) => round(toGamut(color));

// Neutrals

const NEUTRAL_DARKEST = 0.205;
const NEUTRAL_LIGHTEST = 0.97;
const NEUTRAL_STEP_COUNT = 21;
const NEUTRAL_HUE = 268;
/** Grey with a tinge at the dark end, barely tinted at the light end. */
const NEUTRAL_CHROMA_DARKEST = 0.016;
const NEUTRAL_CHROMA_LIGHTEST = 0.004;

export const neutralSteps: Oklch[] = Array.from(
  { length: NEUTRAL_STEP_COUNT },
  (_, i) =>
    make({
      l:
        NEUTRAL_DARKEST +
        (i * (NEUTRAL_LIGHTEST - NEUTRAL_DARKEST)) / (NEUTRAL_STEP_COUNT - 1),
      c:
        NEUTRAL_CHROMA_DARKEST +
        (i * (NEUTRAL_CHROMA_LIGHTEST - NEUTRAL_CHROMA_DARKEST)) /
          (NEUTRAL_STEP_COUNT - 1),
      h: NEUTRAL_HUE,
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
    round(hexToOklch(LEAGUE_EMBED_COLORS[name].toString(16).padStart(6, '0'))),
  ]),
) as Record<Leagues, Oklch>;

const leagueColors = Object.values(leagues);
const mean = (values: number[]) =>
  values.reduce((sum, v) => sum + v, 0) / values.length;

/** Every generated categorical colour shares the leagues' average chroma. */
export const CATEGORY_CHROMA = mean(leagueColors.map(c => c.c));

/** Steps from the ground for each layer; light mode counts from the top. */
const SURFACE_OFFSET = 1;
const RAISED_OFFSET = 2;
const BORDER_OFFSET = 3;
/**
 * Muted and status text are picked to read on this step, not on the raised
 * surface: the surfaces sit close to the ground, but text also lands on
 * tinted fills (draft cells, pick chips) that run lighter than they do.
 */
const TEXT_GROUND_OFFSET = 4;

const neutralStep = (theme: Theme, offset: number) =>
  neutralSteps[theme === 'dark' ? offset : NEUTRAL_STEP_COUNT - 1 - offset];

/** The surfaces a category fill may sit on, in both themes. */
const fillGrounds = THEMES.flatMap(theme => [
  neutralStep(theme, 0),
  neutralStep(theme, SURFACE_OFFSET),
]);

/**
 * The colour at this hue, at the leagues' average chroma and the lightest
 * value that clears FILL_CONTRAST on the ground and on a card, in both
 * themes. Generated colours can meet that bar; some fixed league colours
 * cannot, which is what fill edges are for.
 */
const categoryFill = (h: number) => {
  for (let l = mean(leagueColors.map(c => c.l)); l > 0; l -= 0.005) {
    const color = make({ l, c: CATEGORY_CHROMA, h });
    const visible = fillGrounds.every(
      ground => contrast(color, ground) >= FILL_CONTRAST,
    );
    if (visible) return color;
  }
  throw new Error(`No lightness at hue ${h} clears every fill ground`);
};

// Medals

export type Medal = 'gold' | 'silver' | 'bronze' | 'sacko';

/**
 * A descending lightness sequence. Gold and bronze carry the category chroma,
 * silver none, and the sacko half, so it reads as brown rather than bronze.
 * The sequence starts high so bronze and the sacko sit above the positions'
 * lightness, which keeps them apart from TE and DEF on the same hues.
 */
const MEDAL_TOP = 0.84;
const MEDAL_STEP = 0.08;
const MEDAL_SPEC: Record<Medal, { c: number; h: number }> = {
  gold: { c: CATEGORY_CHROMA, h: 90 },
  silver: { c: 0, h: 0 },
  bronze: { c: CATEGORY_CHROMA, h: 50 },
  sacko: { c: CATEGORY_CHROMA / 2, h: 50 },
};

export const medals = Object.fromEntries(
  (Object.keys(MEDAL_SPEC) as Medal[]).map((name, i) => [
    name,
    make({ l: MEDAL_TOP - i * MEDAL_STEP, ...MEDAL_SPEC[name] }),
  ]),
) as Record<Medal, Oklch>;

// Accent (fixed)

/** The logo orange, exactly. */
const ACCENT_HEX = '#e65719';
const accent = round(hexToOklch(ACCENT_HEX));

/**
 * The red at the other end of the accent gradient: the accent turned toward
 * red, so the bar and the primary button run from the logo orange into red.
 * Only a touch darker than the accent, because the button's dark text has to
 * read on this end too. Fixed, like the accent. A fill, never text.
 */
const ACCENT_RED_HUE = 20;
const ACCENT_RED_DROP = 0.01;
const accentRed = make({
  l: accent.l - ACCENT_RED_DROP,
  c: accent.c,
  h: ACCENT_RED_HUE,
});

/**
 * A deep red for the page glow: darker and a little less vivid than the
 * gradient's red, so mixed into the dark ground it reads as a deep red
 * glow rather than coral. Fixed, like the accent. Never text.
 */
const deepRed = make({ l: 0.42, c: 0.16, h: 25 });

/** The same depth in a field green, for trying the glow in green. */
const deepGreen = make({ l: 0.42, c: 0.12, h: 152 });

/** Hover lifts the accent; lighter also raises its contrast with its text. */
const PRIMARY_HOVER_LIFT = 0.05;
/** How much darker a button's shadow is than the button, for every button. */
const SHADE_DROP = 0.16;

/**
 * Accent text starts from these and steps away from the ground until it reads
 * on the ground and on cards. The light theme needs a deeper orange.
 */
const BRAND_START: Record<Theme, Oklch> = {
  dark: accent,
  light: { l: 0.55, c: 0.17, h: accent.h },
};

// Positions

export type Position = 'qb' | 'rb' | 'wr' | 'te' | 'def';

/**
 * The hues Sleeper's draft board uses, so a position reads
 * the same here as on the board people draft from. Each takes the lightest
 * value its hue allows on every ground, which differs a little from hue to
 * hue. DEF is Sleeper's brown exactly: lifting it to clear every ground
 * makes it too light, so on dark cards it gets an edge instead. RB and WR
 * sit near the Dragon and Galaxy leagues, which is fine: positions and
 * leagues are never read against each other.
 */
const POSITION_HUES: Record<Exclude<Position, 'def'>, number> = {
  qb: 355,
  rb: 166,
  wr: 236,
  te: 66,
};

const DEF_HEX = '#9a5f4e';

export const positions = {
  ...Object.fromEntries(
    Object.entries(POSITION_HUES).map(([name, h]) => [name, categoryFill(h)]),
  ),
  def: round(hexToOklch(DEF_HEX)),
} as Record<Position, Oklch>;

// Value sequence for ordered data (ranks, percentiles)

const SEQUENCE_HUE = leagues.galaxy.h;
const SEQUENCE_DARKEST = 0.4;
const SEQUENCE_LIGHTEST = 0.88;
const SEQUENCE_STEP_COUNT = 7;

export const sequence: Oklch[] = Array.from(
  { length: SEQUENCE_STEP_COUNT },
  (_, i) =>
    make({
      l:
        SEQUENCE_DARKEST +
        (i * (SEQUENCE_LIGHTEST - SEQUENCE_DARKEST)) /
          (SEQUENCE_STEP_COUNT - 1),
      c: CATEGORY_CHROMA,
      h: SEQUENCE_HUE,
    }),
);

// Theme roles

const SEMANTIC_HUES = {
  negative: 25,
  // Yellow, well clear of the orange accent. Dark enough to read on the
  // light theme it turns a deep olive, which still is not the accent.
  warning: 90,
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
    const color = make({ l, c: CATEGORY_CHROMA, h });
    if (contrast(color, against) >= TEXT_CONTRAST) return color;
  }
  throw new Error(`No ${theme} text colour at hue ${h}`);
};

/**
 * The colour at this hue nearest `from` in lightness that clears `ratio`
 * on `against`, stepping away from the theme's ground.
 */
const clearing = (
  from: Oklch,
  theme: Theme,
  against: Oklch[],
  ratio: number,
) => {
  const direction = theme === 'dark' ? 1 : -1;
  for (let l = from.l; l > 0 && l < 1; l += direction * 0.005) {
    const color = make({ ...from, l });
    if (against.every(ground => contrast(color, ground) >= ratio)) {
      return color;
    }
  }
  throw new Error(`Nothing at hue ${from.h} clears ${ratio} in ${theme}`);
};

const buildRoles = (theme: Theme) => {
  const step = (offset: number) => neutralStep(theme, offset);

  const background = step(0);
  const surface = step(SURFACE_OFFSET);
  const raised = step(RAISED_OFFSET);
  const textGround = step(TEXT_GROUND_OFFSET);
  const foreground = step(NEUTRAL_STEP_COUNT - 1);

  /** The first step away from the ground that clears `ratio` on `against`. */
  const firstStepClearing = (ratio: number, against: Oklch) => {
    for (let offset = 0; offset < NEUTRAL_STEP_COUNT; offset++) {
      if (contrast(step(offset), against) >= ratio) return step(offset);
    }
    throw new Error(`No ${theme} step clears ${ratio}`);
  };

  const input = firstStepClearing(FILL_CONTRAST, raised);

  /**
   * The accent is fixed, so where it is too faint to show on the ground or a
   * card (the light theme's cards) it gets a neutral edge, as category fills
   * do.
   */
  const accentShows = [background, surface].every(
    ground => contrast(accent, ground) >= FILL_CONTRAST,
  );

  const semantic = Object.fromEntries(
    Object.entries(SEMANTIC_HUES).map(([name, h]) => [
      name,
      semanticText(h, theme, textGround),
    ]),
  ) as Record<keyof typeof SEMANTIC_HUES, Oklch>;

  return {
    background,
    foreground,
    card: surface,
    'card-foreground': foreground,
    popover: surface,
    'popover-foreground': foreground,
    // A fill, not text. Accent text uses `brand`.
    primary: accent,
    // White on the orange is 3.7:1; the darkest neutral is 4.7:1. The same
    // in both themes, like the accent itself.
    'primary-foreground': neutralSteps[0],
    'primary-hover': make({ ...accent, l: accent.l + PRIMARY_HOVER_LIFT }),
    'primary-edge': accentShows ? accent : input,
    'primary-shade': make({ ...accent, l: accent.l - SHADE_DROP }),
    'primary-red': accentRed,
    'primary-deep': deepRed,
    'field-green': deepGreen,
    brand: clearing(
      BRAND_START[theme],
      theme,
      [background, surface],
      TEXT_CONTRAST,
    ),
    secondary: raised,
    'secondary-foreground': foreground,
    // The drop under a secondary button, as primary-shade is for the accent.
    'secondary-shade': make({ ...raised, l: raised.l - SHADE_DROP }),
    muted: surface,
    'muted-foreground': firstStepClearing(TEXT_CONTRAST, textGround),
    accent: raised,
    'accent-foreground': foreground,
    destructive: semantic.negative,
    'destructive-foreground': textOn(semantic.negative),
    'destructive-shade': make({
      ...semantic.negative,
      l: semantic.negative.l - SHADE_DROP,
    }),
    border: step(BORDER_OFFSET),
    input,
    ring: foreground,
    ...semantic,
  };
};

export type Role = keyof ReturnType<typeof buildRoles>;

const roles: Record<Theme, Record<Role, Oklch>> = {
  dark: buildRoles('dark'),
  light: buildRoles('light'),
};

export const themeRoles = (theme: Theme) => roles[theme];

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
  ['primary-foreground', 'primary-hover'],
  // The foot of the primary button's gradient.
  ['primary-foreground', 'primary-red'],
  ['secondary-foreground', 'secondary'],
  ['accent-foreground', 'accent'],
  ['muted-foreground', 'background'],
  ['muted-foreground', 'muted'],
  ['muted-foreground', 'secondary'],
  ['destructive-foreground', 'destructive'],
  // Accent text is for the page and cards; controls on the secondary
  // surface use neutral text.
  ['brand', 'background'],
  ['brand', 'card'],
  ...(['negative', 'warning', 'positive', 'info'] as const).flatMap(
    (role): [Role, Role][] => [
      [role, 'background'],
      [role, 'card'],
      [role, 'secondary'],
    ],
  ),
];

export const EDGE_PAIRS: [Role, Role][] = [
  ['primary-edge', 'background'],
  ['primary-edge', 'card'],
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

/** The surfaces a category fill may sit on. */
export const FILL_GROUNDS: Role[] = ['background', 'card'];

/**
 * The edge drawn around each category fill. Where the fill clears
 * FILL_CONTRAST on every fill ground the edge is the fill itself, so it
 * disappears; where it does not, the edge is the input step. Every fill always
 * has an edge, so nothing shifts between themes.
 */
export const fillEdges = (theme: Theme) => {
  const themed = themeRoles(theme);
  return Object.fromEntries(
    Object.entries(categoryFills).map(([name, fill]) => {
      const visible = FILL_GROUNDS.every(
        ground => contrast(fill, themed[ground]) >= FILL_CONTRAST,
      );
      return [`${name}-edge`, visible ? fill : themed.input];
    }),
  );
};

/** Enough colour to name the league, quiet enough to read text on. */
// Low: a league panel is a card with a hint of the league, and the colour
// itself is the header band. Much more and a yellow turns to mud brown.
const TINT_CHROMA = 0.014;

/** Each league's tint for the theme, at the theme's card lightness. */
export const leagueTints = (theme: Theme) => {
  const { card } = themeRoles(theme);
  return Object.fromEntries(
    Object.entries(leagues).map(([name, color]) => [
      `league-${name}-tint`,
      make({ l: card.l, c: TINT_CHROMA, h: color.h }),
    ]),
  );
};
