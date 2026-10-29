/**
 * A member's week on the dashboard: what they still have to enter, then one
 * row per thing they are in this season, in the nav's order. League rows say
 * how last week went and who is next; game rows say where they stand.
 *
 * Built from facts the server has already gathered, so the rules can be
 * tested without a database.
 */
import { pts } from '~/libs/guillotine/display';
import {
  CUP_ROUNDS,
  type CupRound,
  ROUND_LABEL,
  isCupRound,
} from '~/models/profile/cupProfile';
import { assignCompetitionRanks } from '~/utils/rank';

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

/** A place among the field: 3rd of 12. */
export type Place = { rank: number; of: number };

/**
 * A side league scored by points alone (D12, Autodraft BBM): the member's
 * place this season, and their score and place in its newest finished week.
 */
export type PointsLeague = {
  season: Place | null;
  lastWeek: (Place & { week: number; points: number }) | null;
};

/** One cup game the member played, from their side. */
export type CupGameFact = {
  round: CupRound;
  won: boolean;
  points: number;
  opponentPoints: number;
  /** Missing on a bye. */
  opponent: string | null;
};

/** Where the member stands in this year's cup. */
export type CupFacts = {
  /** Their newest decided game. */
  lastGame: CupGameFact | null;
  /** The game they are in now, with no winner yet. */
  current: { round: CupRound; opponent: string | null } | null;
  /** The newest round with a winner anywhere in the bracket. */
  latestRound: CupRound | null;
};

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
  /** Null when they are not in this year's bracket, or it is not drawn yet. */
  cup: CupFacts | null;
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
  /** Null when they are not in this year's D12. */
  d12: PointsLeague | null;
  /** Null when they are not in this year's Autodraft BBM. */
  bestBall: PointsLeague | null;
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

/**
 * One score in a points league: an entrant's points for one week. D12
 * enters members; Autodraft BBM enters teams, some with no member.
 */
export type WeekScore = { entrant: string; week: number; points: number };

const placeOf = (
  totals: Map<string, number>,
  entrant: string,
): Place | null => {
  if (!totals.has(entrant)) return null;
  const ranked = assignCompetitionRanks(
    [...totals.entries()]
      .map(([id, total]) => ({ id, total }))
      .sort((a, b) => b.total - a.total),
    row => row.total,
  );
  return {
    rank: ranked.find(row => row.id === entrant)!.rank,
    of: ranked.length,
  };
};

/**
 * A member's season and newest finished week in a league scored by points.
 * A week is finished once the NFL week after it has begun, so a week still
 * being played counts toward the season but is not last week yet.
 */
export function pointsLeague(
  scores: WeekScore[],
  entrant: string,
  currentWeek: number | null,
): PointsLeague {
  const season = new Map<string, number>();
  for (const score of scores) {
    season.set(score.entrant, (season.get(score.entrant) ?? 0) + score.points);
  }

  const finished = scores
    .map(score => score.week)
    .filter(week => currentWeek === null || week < currentWeek);
  const lastWeek = finished.length > 0 ? Math.max(...finished) : null;
  const week = new Map<string, number>();
  for (const score of scores) {
    if (score.week !== lastWeek) continue;
    week.set(score.entrant, (week.get(score.entrant) ?? 0) + score.points);
  }

  const seasonPlace = placeOf(season, entrant);
  const weekPlace = placeOf(week, entrant);
  return {
    season: seasonPlace,
    lastWeek:
      weekPlace && lastWeek !== null
        ? { ...weekPlace, week: lastWeek, points: week.get(entrant)! }
        : null,
  };
}

const pointsLeagueRow = (
  label: string,
  href: string,
  { season, lastWeek }: PointsLeague,
): DashboardRow => ({
  ...blank,
  section: 'Side leagues',
  label,
  lastWeek: lastWeek
    ? `Week ${lastWeek.week}: ${pts(lastWeek.points)} pts, ${ordinal(
        lastWeek.rank,
      )} of ${lastWeek.of}`
    : null,
  thisWeek: season
    ? `${ordinal(season.rank)} of ${season.of} for the season`
    : null,
  href,
});

/** One side of a cup game, as the bracket stores it. */
export type CupGameSide = {
  cupTeamId: string;
  /** The league team, which the round's scores are kept against. */
  teamId: string;
  userId: string | null;
  name: string;
};

/** A cup game: its round, its sides, and its winner once decided. */
export type CupGameRow = {
  round: string;
  top: CupGameSide | null;
  bottom: CupGameSide | null;
  winningTeamId: string | null;
};

/** A team's points in one round, summed over its weeks, as the bracket has. */
export type CupRoundScore = {
  teamId: string;
  mapping: string;
  pointsScored: number;
};

const roundIndex = (round: CupRound) => CUP_ROUNDS.indexOf(round);

const newest = <T extends { round: CupRound }>(items: T[]) =>
  items.reduce<T | null>(
    (latest, item) =>
      !latest || roundIndex(item.round) > roundIndex(latest.round)
        ? item
        : latest,
    null,
  );

/**
 * Where the member stands in the cup, from the bracket's games and scores.
 * Null when they have no game, as before the bracket is drawn.
 */
export function cupFacts(
  games: CupGameRow[],
  scores: CupRoundScore[],
  userId: string,
): CupFacts | null {
  const rounds = games.flatMap(game =>
    isCupRound(game.round) ? [{ ...game, round: game.round }] : [],
  );
  const points = (side: CupGameSide | null, round: CupRound) =>
    scores.find(
      score => score.teamId === side?.teamId && score.mapping === round,
    )?.pointsScored ?? 0;

  const mine = rounds.flatMap(game => {
    const [me, them] =
      game.top?.userId === userId
        ? [game.top, game.bottom]
        : game.bottom?.userId === userId
        ? [game.bottom, game.top]
        : [null, null];
    return me ? [{ ...game, me, them }] : [];
  });
  if (mine.length === 0) return null;

  const decided = newest(mine.filter(game => game.winningTeamId));
  const current = newest(mine.filter(game => !game.winningTeamId));
  return {
    lastGame: decided && {
      round: decided.round,
      won: decided.winningTeamId === decided.me.cupTeamId,
      points: points(decided.me, decided.round),
      opponentPoints: points(decided.them, decided.round),
      opponent: decided.them?.name ?? null,
    },
    current: current && {
      round: current.round,
      opponent: current.them?.name ?? null,
    },
    latestRound:
      newest(rounds.filter(game => game.winningTeamId))?.round ?? null,
  };
}

/** How their newest cup game went, while that round is the newest. */
const cupLastWeek = ({ lastGame, latestRound }: CupFacts) => {
  if (!lastGame || lastGame.round !== latestRound) return null;
  const round = ROUND_LABEL[lastGame.round];
  if (!lastGame.opponent) return `${round}: bye`;
  return `${round}: ${lastGame.won ? 'won' : 'lost'} ${pts(
    lastGame.points,
  )} to ${pts(lastGame.opponentPoints)} against ${lastGame.opponent}`;
};

/** Their cup game now, or where their run ended. */
const cupThisWeek = ({ lastGame, current }: CupFacts) => {
  if (current) {
    const round = ROUND_LABEL[current.round];
    return current.opponent
      ? `${round} against ${current.opponent}`
      : `${round}: bye`;
  }
  if (!lastGame) return null;
  if (lastGame.round === 'ROUND_OF_2') {
    return lastGame.won ? 'Champion' : 'Runner-up';
  }
  return lastGame.won
    ? null
    : `Out in the ${ROUND_LABEL[lastGame.round].toLowerCase()}`;
};

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

  if (facts.cup) {
    rows.push({
      ...blank,
      section: 'Leagues',
      label: 'Cup',
      lastWeek: cupLastWeek(facts.cup),
      thisWeek: cupThisWeek(facts.cup),
      href: '/leagues/cup',
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

  if (facts.d12) {
    rows.push(pointsLeagueRow('D12', '/side-leagues/d12', facts.d12));
  }
  if (facts.bestBall) {
    rows.push(
      pointsLeagueRow(
        'Autodraft BBM',
        '/side-leagues/best-ball',
        facts.bestBall,
      ),
    );
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
