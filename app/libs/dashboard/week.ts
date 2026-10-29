/**
 * A member's week on the dashboard: what they still have to enter, then one
 * row per thing they are in this season, in the nav's order. League rows say
 * how last week went and who is next; game rows say where they stand.
 *
 * Built from facts the server has already gathered, so the rules can be
 * tested without a database.
 */

export type DashboardSection = 'Leagues' | 'Side leagues' | 'Games';

export type DashboardRow = {
  section: DashboardSection;
  label: string;
  lastWeek: string | null;
  /** Leagues and side leagues: this week's matchup or status. */
  thisWeek: string | null;
  /** Games: their place in this season's table, "3rd of 24". */
  standing: string | null;
  /** Games: their season total, "1240 bank". */
  season: string | null;
  href: string;
};

/** Something the member has not entered for this week, and where to. */
export type TodoItem = { label: string; href: string };

/** A weekly pick'em game's week, as the member stands in it. */
export type PickWeek = {
  id: string;
  week: number;
  isOpen: boolean;
  isScored: boolean;
  /** How many picks the member has in. */
  picks: number;
};

/** Where the member stands in one game this season. */
export type GameStanding = {
  rank: number;
  /** How many are ranked. */
  of: number;
  /** The season total, formatted with its unit. */
  total: string;
  /** Their result in the game's newest scored week. */
  lastWeek: string | null;
};

export type StandingGame =
  | 'qbStreaming'
  | 'spreadPool'
  | 'locks'
  | 'dfsSurvivor'
  | 'fSquared';

export type MemberWeekFacts = {
  year: number;
  league: {
    name: string;
    /** Whether any week has scores yet; the Matchups tab waits for one. */
    hasScores: boolean;
    lastWeek: {
      week: number;
      points: number;
      opponentPoints: number;
      opponent: string;
    } | null;
    thisWeek: { week: number; opponent: string } | null;
  } | null;
  guillotine: {
    leagueId: string;
    name: string;
    choppedWeek: number | null;
    finish: number | null;
  }[];
  qbStreaming: PickWeek | null;
  spreadPool: PickWeek | null;
  locks: PickWeek | null;
  dfsSurvivor: {
    week: number;
    entries: number;
    isLocked: boolean;
  } | null;
  /** Only the games the member has a scored week in this season. */
  standings: Partial<Record<StandingGame, GameStanding>>;
  survivor: { poolId: string; name: string; alive: boolean }[];
  fSquared: { isOpen: boolean; hasEntry: boolean };
  registration: { isOpen: boolean; isRegistered: boolean };
};

const ORDER: DashboardSection[] = ['Leagues', 'Games', 'Side leagues'];

const result = (points: number, opponentPoints: number) =>
  points > opponentPoints ? 'Won' : points < opponentPoints ? 'Lost' : 'Tied';

const ordinal = (n: number) => {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
};

const blank = { lastWeek: null, thisWeek: null, standing: null, season: null };

/** The Games section's games, in the sitemap's order. */
const GAMES: { key: StandingGame; label: string; href: string }[] = [
  { key: 'qbStreaming', label: 'QB streaming', href: '/games/qb-streaming' },
  { key: 'spreadPool', label: 'Spread pool', href: '/games/spread-pool' },
  { key: 'locks', label: 'Locks challenge', href: '/games/locks-challenge' },
  { key: 'dfsSurvivor', label: 'DFS survivor', href: '/games/dfs-survivor' },
  { key: 'fSquared', label: 'F²', href: '/games/f-squared' },
];

/** A pick'em week the member could enter now and has not. */
const pickTodo = (week: PickWeek | null) =>
  !!week && week.isOpen && !week.isScored && week.picks === 0;

/** Everything the member has not entered for this week. */
function todos(facts: MemberWeekFacts): TodoItem[] {
  const items: (TodoItem | null)[] = [
    facts.registration.isOpen && !facts.registration.isRegistered
      ? {
          label: `${facts.year} registration`,
          href: '/dashboard/registration',
        }
      : null,
    ...(
      [
        ['QB streaming', '/games/qb-streaming', facts.qbStreaming],
        ['Spread pool', '/games/spread-pool', facts.spreadPool],
        ['Locks challenge', '/games/locks-challenge', facts.locks],
      ] as const
    ).map(([label, href, week]) =>
      pickTodo(week) ? { label, href: `${href}/entries/${week!.id}` } : null,
    ),
    facts.dfsSurvivor &&
    !facts.dfsSurvivor.isLocked &&
    facts.dfsSurvivor.entries === 0
      ? { label: 'DFS survivor', href: '/games/dfs-survivor/entries' }
      : null,
    facts.fSquared.isOpen && !facts.fSquared.hasEntry
      ? { label: 'F²', href: '/games/f-squared/entries' }
      : null,
  ];
  return items.filter((item): item is TodoItem => item !== null);
}

/** Whether the member has anything in for the game this week. */
function enteredThisWeek(facts: MemberWeekFacts, game: StandingGame) {
  switch (game) {
    case 'qbStreaming':
    case 'spreadPool':
    case 'locks':
      return (facts[game]?.picks ?? 0) > 0;
    case 'dfsSurvivor':
      return (facts.dfsSurvivor?.entries ?? 0) > 0;
    case 'fSquared':
      return facts.fSquared.hasEntry;
  }
}

export function buildMemberWeek(facts: MemberWeekFacts): {
  todo: TodoItem[];
  rows: DashboardRow[];
} {
  const rows: DashboardRow[] = [];

  if (facts.league) {
    const { lastWeek, thisWeek, name } = facts.league;
    rows.push({
      ...blank,
      section: 'Leagues',
      label: name,
      lastWeek: lastWeek
        ? `${result(
            lastWeek.points,
            lastWeek.opponentPoints,
          )} ${lastWeek.points.toFixed(2)} to ${lastWeek.opponentPoints.toFixed(
            2,
          )} against ${lastWeek.opponent}`
        : null,
      thisWeek: thisWeek
        ? `Week ${thisWeek.week} against ${thisWeek.opponent}`
        : null,
      href: `/leagues/${facts.year}/${name.toLowerCase()}${
        facts.league.hasScores ? '/matchups' : ''
      }`,
    });
  }

  if (facts.registration.isOpen) {
    rows.push({
      ...blank,
      section: 'Leagues',
      label: `${facts.year} registration`,
      thisWeek: facts.registration.isRegistered
        ? 'Registered'
        : 'Not registered yet',
      href: '/dashboard/registration',
    });
  }

  for (const team of facts.guillotine) {
    rows.push({
      ...blank,
      section: 'Side leagues',
      label: team.name,
      thisWeek:
        team.finish === 1
          ? 'Champion'
          : team.choppedWeek
          ? `Chopped in week ${team.choppedWeek}`
          : 'Still alive',
      href: `/side-leagues/guillotine/${team.leagueId}`,
    });
  }

  // A game the member has played this season, or has entered this week
  // before any week is scored.
  for (const game of GAMES) {
    const standing = facts.standings[game.key];
    if (!standing && !enteredThisWeek(facts, game.key)) continue;
    rows.push({
      ...blank,
      section: 'Games',
      label: game.label,
      standing: standing ? `${ordinal(standing.rank)} of ${standing.of}` : null,
      season: standing?.total ?? null,
      lastWeek: standing?.lastWeek ?? null,
      href: game.href,
    });
  }

  for (const entry of facts.survivor) {
    rows.push({
      ...blank,
      section: 'Games',
      label: entry.name,
      standing: entry.alive ? 'Still alive' : 'Out',
      href: `/games/survivor/${entry.poolId}`,
    });
  }

  return {
    todo: todos(facts),
    rows: rows
      .map((row, index) => ({ row, index }))
      .sort(
        (a, b) =>
          ORDER.indexOf(a.row.section) - ORDER.indexOf(b.row.section) ||
          a.index - b.index,
      )
      .map(({ row }) => row),
  };
}
