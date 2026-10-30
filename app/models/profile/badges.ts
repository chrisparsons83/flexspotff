/**
 * The badge catalog and its tiers.
 *
 * A badge everyone holds says nothing, so each one is banded: the same badge
 * means more at a higher tier, and the bands are set where they separate people
 * rather than where they include everyone.
 *
 * Pure, so the banding is testable without a database.
 */

export type Badge = {
  key: string;
  label: string;
  /** The real number behind the badge - seasons, points, titles. */
  value: number;
  /** Which band was reached, 1-based. */
  tier: number;
  /** How many bands the badge has, so the UI can show tier 2 of 3. */
  tierCount: number;
  scale: BadgeScale;
  fill: BadgeFill;
  description: string;
};

/**
 * How a badge turns a number into stars.
 *
 * Anything won - a title, a sacko - is a `'tally'`: one star each, no ceiling,
 * because a fourth championship should read as more than a third.
 *
 * The rest are banded, and the bands are set where they separate people rather
 * than where they include everyone. Thresholds are listed lowest first and read
 * as the badge's own units - `[1, 5, 10]` seasons, `[150, 175, 200]` points.
 * These are the badges where a ceiling is the point: every member accumulates
 * seasons, so the badge has to say how many is a lot.
 */
export type BadgeScale = number[] | 'tally';

/**
 * The token colour of a badge's block. Titles are medals: the top tier's
 * title wears the Champions colour, league and Cup titles gold, side-game
 * titles silver, and the sacko its own medal. Banded badges are `sequence`:
 * the block steps through the value sequence by tier, so a higher tier is a
 * lighter block.
 */
export type BadgeFill =
  | 'league-champions'
  | 'medal-gold'
  | 'medal-silver'
  | 'medal-sacko'
  | 'sequence';

type BadgeDefinition = {
  key: string;
  label: string;
  scale: BadgeScale;
  fill: BadgeFill;
  description: string;
};

/**
 * Every badge, in the order they appear on a profile: league honours first,
 * then side-game titles, then the longevity and scoring bands.
 */
export const BADGE_DEFINITIONS: Record<string, BadgeDefinition> = {
  /**
   * The rarest thing on the site: winning the title in the top tier. Tallied
   * rather than banded, so a second and a third each show as their own star.
   */
  championOfChampions: {
    key: 'champion-of-champions',
    label: 'Champion of Champions',
    scale: 'tally',
    fill: 'league-champions',
    description: 'Won the Champions League title',
  },
  leagueChampion: {
    key: 'league-champion',
    label: 'League Champion',
    scale: 'tally',
    fill: 'medal-gold',
    description: 'Won a league championship',
  },
  cupChampion: {
    key: 'cup-champion',
    label: 'Cup Champion',
    scale: 'tally',
    fill: 'medal-gold',
    description: 'Won the Cup',
  },
  sacko: {
    key: 'sacko',
    label: 'Sacko',
    scale: 'tally',
    fill: 'medal-sacko',
    description: 'Finished last - scored lowest in the sacko final',
  },
  championsLeague: {
    key: 'champions-league',
    label: 'Champions League',
    scale: [1, 3, 5],
    fill: 'sequence',
    description: 'Seasons played in the top tier',
  },
  seasonsPlayed: {
    key: 'seasons',
    label: 'Seasons Played',
    scale: [1, 5, 10],
    fill: 'sequence',
    description: 'Seasons in the redraft league',
  },
  highScoringWeek: {
    key: 'high-scoring-week',
    label: 'High-Scoring Week',
    scale: [150, 175, 200],
    fill: 'sequence',
    description: 'Highest score in a single week',
  },
  winStreak: {
    key: 'win-streak',
    label: 'Win Streak',
    scale: [5, 10, 15, 20],
    fill: 'sequence',
    description: 'Longest run of consecutive wins',
  },
};

/**
 * Side-game titles. Each game earns the same badge on the same scale, so
 * winning the Spread Pool reads exactly like winning DFS Survivor.
 */
export const SIDE_GAME_BADGES = {
  d12: {
    label: 'D12 Champion',
    fill: 'medal-silver',
  },
  qbStreaming: {
    label: 'QB Streaming Champion',
    fill: 'medal-silver',
  },
  spreadPool: {
    label: 'Spread Pool Champion',
    fill: 'medal-silver',
  },
  locks: {
    label: 'Locks Champion',
    fill: 'medal-silver',
  },
  dfsSurvivor: {
    label: 'DFS Survivor Champion',
    fill: 'medal-silver',
  },
  guillotine: {
    label: 'Guillotine Champion',
    fill: 'medal-silver',
  },
  bestBall: {
    label: 'Autodraft BBM Champion',
    fill: 'medal-silver',
  },
  survivor: {
    label: 'Survivor Champion',
    fill: 'medal-silver',
  },
  fSquared: {
    label: 'F² Champion',
    fill: 'medal-silver',
  },
} as const;

export type SideGameKey = keyof typeof SIDE_GAME_BADGES;

/** Every side game that can be won, in display order. */
export const SIDE_GAME_KEYS = Object.keys(SIDE_GAME_BADGES) as SideGameKey[];

/** Side game titles are counted, not banded - see `BadgeScale`. */
const SIDE_GAME_SCALE = 'tally' as const;

/**
 * Which band a value reaches, or 0 for none.
 *
 * Thresholds are read highest-first so a value lands in the best band it
 * qualifies for rather than the first one it passes.
 */
export function tierFor(value: number, thresholds: number[]): number {
  for (let i = thresholds.length - 1; i >= 0; i--) {
    if (value >= thresholds[i]) return i + 1;
  }
  return 0;
}

/**
 * Builds a badge if the value earns at least one star, otherwise nothing -
 * which is how a badge stays absent rather than showing as an empty one.
 */
export function makeBadge(
  definition: BadgeDefinition,
  value: number,
): Badge | null {
  // A tally badge has no ceiling: every win is its own star, because these are
  // rare enough that a third and a fourth should still read as more.
  const tier =
    definition.scale === 'tally'
      ? Math.floor(value)
      : tierFor(value, definition.scale);
  if (tier < 1) return null;

  return {
    key: definition.key,
    label: definition.label,
    value,
    tier,
    tierCount: definition.scale === 'tally' ? tier : definition.scale.length,
    scale: definition.scale,
    fill: definition.fill,
    description: definition.description,
  };
}

/** A side-game title badge: one star per season won.  */
export function makeSideGameBadge(
  game: SideGameKey,
  titles: number,
): Badge | null {
  const { label, fill } = SIDE_GAME_BADGES[game];

  return makeBadge(
    {
      key: `${game}-champion`,
      label,
      fill,
      scale: SIDE_GAME_SCALE,
      description: `Won ${label.replace(' Champion', '')}`,
    },
    titles,
  );
}
