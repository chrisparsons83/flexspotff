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
  scale: BadgeScale;
  accent: BadgeAccent;
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
 * A badge's own colour, as whole Tailwind classes.
 *
 * Whole classes rather than a token, because Tailwind only emits what it can
 * find written out in the source - a `border-${colour}` built at runtime
 * compiles to nothing.
 */
export type BadgeAccent = {
  border: string;
  text: string;
  /** A dark wash of the same colour, so the ribbon is tinted rather than grey. */
  bg: string;
  /**
   * Light ribbons, for the two awards that have to read as gold.
   *
   * Every other badge is a dark wash of its own colour, which works for all of
   * them except gold: dark gold over a slate card is brown, and it put the
   * league title, the Champions League title and the *sacko* in the same
   * family. These two go the other way and sit on the metal itself, which
   * means the label has to flip dark.
   */
  tone?: 'light';
};

type BadgeDefinition = {
  key: string;
  label: string;
  emoji: string;
  scale: BadgeScale;
  /** One colour per badge, so a row of them reads as a set of awards rather
   *  than a ranking - the stars already carry the ranking. */
  accent: BadgeAccent;
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
    emoji: '👑',
    scale: 'tally',
    accent: {
      border: 'border-amber-600',
      text: 'text-amber-800',
      bg: 'bg-amber-300',
      tone: 'light',
    },
    description: 'Won the Champions League title',
  },
  leagueChampion: {
    key: 'league-champion',
    label: 'League Champion',
    emoji: '🏆',
    scale: 'tally',
    accent: {
      border: 'border-amber-500',
      text: 'text-amber-700',
      bg: 'bg-amber-200',
      tone: 'light',
    },
    description: 'Won a league championship',
  },
  cupChampion: {
    key: 'cup-champion',
    label: 'Cup Champion',
    emoji: '🥇',
    scale: 'tally',
    accent: {
      border: 'border-sky-400',
      text: 'text-sky-300',
      bg: 'bg-sky-950/60',
    },
    description: 'Won the Cup',
  },
  sacko: {
    key: 'sacko',
    label: 'Sacko',
    emoji: '💩',
    scale: 'tally',
    accent: {
      border: 'border-brown',
      text: 'text-brown',
      bg: 'bg-amber-950/60',
    },
    description: 'Finished last - scored lowest in the sacko final',
  },
  championsLeague: {
    key: 'champions-league',
    label: 'Champions League',
    emoji: '🛡️',
    scale: [1, 3, 5],
    accent: {
      border: 'border-violet-400',
      text: 'text-violet-300',
      bg: 'bg-violet-950/60',
    },
    description: 'Seasons played in the top tier',
  },
  seasonsPlayed: {
    key: 'seasons',
    label: 'Seasons Played',
    emoji: '📅',
    scale: [1, 5, 10],
    accent: {
      border: 'border-blue-400',
      text: 'text-blue-300',
      bg: 'bg-blue-950/60',
    },
    description: 'Seasons in the redraft league',
  },
  highScoringWeek: {
    key: 'high-scoring-week',
    label: 'High Scoring Week',
    emoji: '💥',
    scale: [150, 175, 200],
    accent: {
      border: 'border-rose-400',
      text: 'text-rose-300',
      bg: 'bg-rose-950/60',
    },
    description: 'Highest score in a single week',
  },
  winStreak: {
    key: 'win-streak',
    label: 'Win Streak',
    emoji: '🔥',
    scale: [5, 10, 15, 20],
    accent: {
      border: 'border-red-500',
      text: 'text-red-400',
      bg: 'bg-red-950/60',
    },
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
    emoji: '🎯',
    accent: {
      border: 'border-emerald-400',
      text: 'text-emerald-300',
      bg: 'bg-emerald-950/60',
    },
  },
  qbStreaming: {
    label: 'QB Streaming Champion',
    emoji: '🏈',
    accent: {
      border: 'border-cyan-400',
      text: 'text-cyan-300',
      bg: 'bg-cyan-950/60',
    },
  },
  spreadPool: {
    label: 'Spread Pool Champion',
    emoji: '💰',
    accent: {
      border: 'border-green-400',
      text: 'text-green-300',
      bg: 'bg-green-950/60',
    },
  },
  locks: {
    label: 'Locks Champion',
    emoji: '🔒',
    accent: {
      border: 'border-indigo-400',
      text: 'text-indigo-300',
      bg: 'bg-indigo-950/60',
    },
  },
  dfsSurvivor: {
    label: 'DFS Survivor Champion',
    emoji: '👥',
    // Not orange: a dark wash of orange is brown, and it made this badge the
    // twin of the sacko two rows up.
    accent: {
      border: 'border-lime-400',
      text: 'text-lime-300',
      bg: 'bg-lime-950/60',
    },
  },
  fSquared: {
    label: 'F² Champion',
    emoji: '🧮',
    accent: {
      border: 'border-fuchsia-400',
      text: 'text-fuchsia-300',
      bg: 'bg-fuchsia-950/60',
    },
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
    emoji: definition.emoji,
    value,
    tier,
    tierCount: definition.scale === 'tally' ? tier : definition.scale.length,
    scale: definition.scale,
    accent: definition.accent,
    description: definition.description,
  };
}

/**
 * What a member's stars actually mean, for the tooltip.
 *
 * A row of stars is comparable but not self-explanatory - it says this member
 * has two of a possible three without saying two of what, or what the third
 * would take. This spells out both, which is the whole reason the scale is
 * carried on the badge.
 */
export function describeTier(badge: Badge): string {
  const earned = `${badge.description} (${badge.value}).`;

  if (badge.scale === 'tally') {
    return `${earned} One star for each - there is no cap on this one.`;
  }

  const stars = `${badge.tier} of ${badge.tierCount} stars.`;
  const next = badge.scale[badge.tier];

  return `${earned} ${stars} ${
    next === undefined
      ? 'This is the top band.'
      : `${next} earns the next star.`
  }`;
}

/** A side-game title badge: one star per season won.  */
export function makeSideGameBadge(
  game: SideGameKey,
  titles: number,
): Badge | null {
  const { label, emoji, accent } = SIDE_GAME_BADGES[game];

  return makeBadge(
    {
      key: `${game}-champion`,
      label,
      emoji,
      accent,
      scale: SIDE_GAME_SCALE,
      description: `Won ${label.replace(' Champion', '')}`,
    },
    titles,
  );
}
