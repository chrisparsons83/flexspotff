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
  emoji: string;
  /** The real number behind the badge - seasons, points, titles. */
  value: number;
  /** Which band was reached, 1-based. */
  tier: number;
  /** How many bands the badge has, so the UI can show tier 2 of 3. */
  tierCount: number;
  description: string;
};

/**
 * Thresholds are listed lowest first, and a value must reach one to earn it.
 * They read as the badge's own scale: `[1, 5, 10]` seasons, `[150, 175, 200]`
 * points.
 */
type BadgeDefinition = {
  key: string;
  label: string;
  emoji: string;
  thresholds: number[];
  description: string;
};

/**
 * Every badge, in the order they appear on a profile: league honours first,
 * then side-game titles, then the longevity and scoring bands.
 */
export const BADGE_DEFINITIONS: Record<string, BadgeDefinition> = {
  leagueChampion: {
    key: 'league-champion',
    label: 'League Champion',
    emoji: '🏆',
    thresholds: [1, 2, 3],
    description: 'Won a league championship',
  },
  cupChampion: {
    key: 'cup-champion',
    label: 'Cup Champion',
    emoji: '🥇',
    thresholds: [1, 2, 3],
    description: 'Won the Cup',
  },
  sacko: {
    key: 'sacko',
    label: 'Sacko',
    emoji: '🚽',
    thresholds: [1, 2, 3],
    description: 'Finished last - scored lowest in the sacko final',
  },
  championsLeague: {
    key: 'champions-league',
    label: 'Champions League',
    emoji: '👑',
    thresholds: [1, 3, 5],
    description: 'Seasons played in the top tier',
  },
  seasonsPlayed: {
    key: 'seasons',
    label: 'Seasons Played',
    emoji: '📅',
    thresholds: [1, 5, 10],
    description: 'Seasons in the redraft league',
  },
  highScoringWeek: {
    key: 'high-scoring-week',
    label: 'High Scoring Week',
    emoji: '💥',
    thresholds: [150, 175, 200],
    description: 'Highest score in a single week',
  },
  winStreak: {
    key: 'win-streak',
    label: 'Win Streak',
    emoji: '🔥',
    thresholds: [5, 10, 15, 20],
    description: 'Longest run of consecutive wins',
  },
};

/**
 * Side-game titles. Each game earns the same badge on the same scale, so
 * winning the Spread Pool reads exactly like winning DFS Survivor.
 */
export const SIDE_GAME_BADGES = {
  d12: { label: 'D12 Champion', emoji: '🎯' },
  qbStreaming: { label: 'QB Streaming Champion', emoji: '🎽' },
  spreadPool: { label: 'Spread Pool Champion', emoji: '💰' },
  locks: { label: 'Locks Champion', emoji: '🔒' },
  dfsSurvivor: { label: 'DFS Survivor Champion', emoji: '🏈' },
  fSquared: { label: 'F² Champion', emoji: '🧮' },
} as const;

export type SideGameKey = keyof typeof SIDE_GAME_BADGES;

/** Every side game that can be won, in display order. */
export const SIDE_GAME_KEYS = Object.keys(SIDE_GAME_BADGES) as SideGameKey[];

const SIDE_GAME_THRESHOLDS = [1, 2, 3];

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
 * Builds a badge if the value reaches its first threshold, otherwise nothing —
 * which is how a badge stays absent rather than showing as an empty one.
 */
export function makeBadge(
  definition: BadgeDefinition,
  value: number,
): Badge | null {
  const tier = tierFor(value, definition.thresholds);
  if (tier === 0) return null;

  return {
    key: definition.key,
    label: definition.label,
    emoji: definition.emoji,
    value,
    tier,
    tierCount: definition.thresholds.length,
    description: definition.description,
  };
}

/** A side-game title badge, on the shared 1/2/3 scale. */
export function makeSideGameBadge(
  game: SideGameKey,
  titles: number,
): Badge | null {
  const { label, emoji } = SIDE_GAME_BADGES[game];

  return makeBadge(
    {
      key: `${game}-champion`,
      label,
      emoji,
      thresholds: SIDE_GAME_THRESHOLDS,
      description: `Won ${label.replace(' Champion', '')}`,
    },
    titles,
  );
}
