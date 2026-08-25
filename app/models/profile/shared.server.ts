/**
 * The aggregations behind both the Record Books and member profiles.
 *
 * These two features want the same numbers at different scopes: the record book
 * ranks every member and keeps the top of each list, a profile keeps one member
 * and shows everything. Computing them in one place is what stops the two from
 * drifting apart, and it is why these functions take already-fetched rows rather
 * than querying - the callers know which slice of data they need.
 */

export type MedianRecord = {
  medianWins: number;
  medianLosses: number;
  medianTies: number;
};

export type TeamRecord = MedianRecord & {
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
};

export type CareerStats = TeamRecord & {
  userId: string;
  name: string;
  seasons: number;
};

/** Head-to-head games only; median games are counted separately. */
export function totalGames(record: {
  wins: number;
  losses: number;
  ties: number;
}): number {
  return record.wins + record.losses + record.ties;
}

export function winPct(record: {
  wins: number;
  losses: number;
  ties: number;
}): number {
  const games = totalGames(record);
  return games > 0 ? record.wins / games : 0;
}

export function medianGames(record: MedianRecord): number {
  return record.medianWins + record.medianLosses + record.medianTies;
}

export function averagePerSeason(total: number, seasons: number): number {
  return seasons > 0 ? total / seasons : 0;
}

type AggregatableTeam = TeamRecord & {
  userId: string | null;
  user?: { discordName?: string | null } | null;
};

/**
 * Rolls a member's seasons up into one career line.
 *
 * Teams with no `userId` are skipped: those are unclaimed Sleeper rosters, and
 * counting them would invent a member. Grouping by `userId` also resolves
 * merged accounts for free, because a merge re-points `Team.userId` at the
 * canonical member.
 */
export function aggregateCareerStats(
  teams: AggregatableTeam[],
): Map<string, CareerStats> {
  const careers = new Map<string, CareerStats>();

  for (const team of teams) {
    if (!team.userId) continue;

    const existing = careers.get(team.userId) ?? {
      userId: team.userId,
      name: team.user?.discordName || 'Unknown',
      seasons: 0,
      wins: 0,
      losses: 0,
      ties: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      medianWins: 0,
      medianLosses: 0,
      medianTies: 0,
    };

    existing.seasons++;
    existing.wins += team.wins;
    existing.losses += team.losses;
    existing.ties += team.ties;
    existing.pointsFor += team.pointsFor;
    existing.pointsAgainst += team.pointsAgainst;
    existing.medianWins += team.medianWins;
    existing.medianLosses += team.medianLosses;
    existing.medianTies += team.medianTies;

    careers.set(team.userId, existing);
  }

  return careers;
}

export type GameResult = 'W' | 'L' | 'T';

type PairableGame = {
  teamId: string;
  week: number;
  sleeperMatchupId: number;
  pointsScored: number;
  team: { leagueId: string };
};

/**
 * Stand-in `sleeperMatchupId` for a team-week with no opponent. Written by
 * `syncSleeperWeeklyScores` when Sleeper reports a null matchup id.
 */
export const NO_MATCHUP = -1;

export type PairedGame<T extends PairableGame> = {
  game: T;
  opponent: T;
  result: GameResult;
};

/**
 * Matches each team-week up with its opponent.
 *
 * Sleeper reuses matchup ids across weeks, so the key has to include the week -
 * without it every matchup id collapses into one oversized group and nothing
 * pairs. Groups that do not hold exactly two teams are dropped: a bye, a
 * mid-season roster removal, or a half-written sync cannot produce a result.
 */
export function pairTeamGames<T extends PairableGame>(
  games: T[],
): PairedGame<T>[] {
  const matchups = new Map<string, T[]>();

  for (const game of games) {
    // The sync writes NO_MATCHUP when Sleeper reports no opponent - a bye, or a
    // team sitting out the postseason. Those rows share a key, so two of them in
    // one league-week would otherwise pair into a game nobody played.
    if (game.sleeperMatchupId === NO_MATCHUP) continue;

    const key = `${game.team.leagueId}:${game.week}:${game.sleeperMatchupId}`;
    const group = matchups.get(key);
    if (group) {
      group.push(game);
    } else {
      matchups.set(key, [game]);
    }
  }

  const paired: PairedGame<T>[] = [];

  for (const group of matchups.values()) {
    if (group.length !== 2) continue;
    const [first, second] = group;

    const firstResult: GameResult =
      first.pointsScored > second.pointsScored
        ? 'W'
        : first.pointsScored < second.pointsScored
        ? 'L'
        : 'T';
    const secondResult: GameResult =
      firstResult === 'W' ? 'L' : firstResult === 'L' ? 'W' : 'T';

    paired.push({ game: first, opponent: second, result: firstResult });
    paired.push({ game: second, opponent: first, result: secondResult });
  }

  return paired;
}

export type Streak = {
  length: number;
  startIndex: number;
  endIndex: number;
};

/**
 * The longest run of consecutive entries satisfying `predicate`.
 *
 * Callers are responsible for ordering; this walks the array as given.
 */
export function computeStreak<T>(
  items: T[],
  predicate: (item: T) => boolean,
): Streak | null {
  let best = 0;
  let bestStart = 0;
  let bestEnd = 0;
  let current = 0;
  let currentStart = 0;

  for (let i = 0; i < items.length; i++) {
    if (predicate(items[i])) {
      if (current === 0) currentStart = i;
      current++;
      if (current > best) {
        best = current;
        bestStart = currentStart;
        bestEnd = i;
      }
    } else {
      current = 0;
    }
  }

  return best > 0
    ? { length: best, startIndex: bestStart, endIndex: bestEnd }
    : null;
}

export type CupStats = {
  userId: string;
  name: string;
  championships: number;
  finalsAppearances: number;
  gameWins: number;
  gamesPlayed: number;
};

/** The Cup's final. Rounds are named rather than numbered. */
export const CUP_FINAL_ROUND = 'ROUND_OF_2';

type AggregatableCupSide = {
  team: {
    userId: string | null;
    user?: { discordName?: string | null } | null;
  };
} | null;

type AggregatableCupGame = {
  round: string;
  topTeam?: AggregatableCupSide;
  bottomTeam?: AggregatableCupSide;
  winningTeam?: AggregatableCupSide;
};

/**
 * Rolls up a member's Cup history: games played, games won, finals reached and
 * titles.
 *
 * Callers pass only games that have a winner, so an unplayed bracket slot never
 * counts as a game played.
 */
export function aggregateCupStats(
  cupGames: AggregatableCupGame[],
): Map<string, CupStats> {
  const stats = new Map<string, CupStats>();

  const forSide = (side: AggregatableCupSide): CupStats | null => {
    const userId = side?.team.userId;
    if (!userId) return null;

    const existing = stats.get(userId);
    if (existing) return existing;

    const created: CupStats = {
      userId,
      name: side?.team.user?.discordName || 'Unknown',
      championships: 0,
      finalsAppearances: 0,
      gameWins: 0,
      gamesPlayed: 0,
    };
    stats.set(userId, created);
    return created;
  };

  for (const game of cupGames) {
    const top = forSide(game.topTeam ?? null);
    const bottom = forSide(game.bottomTeam ?? null);
    const winner = forSide(game.winningTeam ?? null);

    if (top) top.gamesPlayed++;
    if (bottom) bottom.gamesPlayed++;
    if (winner) winner.gameWins++;

    if (game.round === CUP_FINAL_ROUND) {
      if (top) top.finalsAppearances++;
      if (bottom) bottom.finalsAppearances++;
      if (winner) winner.championships++;
    }
  }

  return stats;
}

export type PlayoffStats = {
  userId: string;
  name: string;
  /** Won the winners bracket. */
  championships: number;
  /** Came last: advanced all the way through the sacko bracket. */
  sackos: number;
  /** Seasons that reached the real playoffs. */
  appearances: number;
  wins: number;
  losses: number;
  /** Seasons that ended up in the sacko bracket instead. */
  sackoAppearances: number;
  /** Record within the sacko bracket, scored by who outscored whom. */
  sackoWins: number;
  sackoLosses: number;
};

type AggregatablePlayoffSide = {
  userId: string | null;
  user?: { discordName?: string | null } | null;
} | null;

type AggregatablePlayoffGame = {
  bracket: 'WINNERS' | 'LOSERS';
  isTitleGame: boolean;
  countsTowardRecord: boolean;
  leagueId: string;
  topTeam?: AggregatablePlayoffSide;
  bottomTeam?: AggregatablePlayoffSide;
  winningTeam?: AggregatablePlayoffSide;
  /**
   * Who moved on. The winners bracket advances whoever scored more; the sacko
   * bracket advances whoever scored less, so this is the only field that means
   * the same thing in both.
   */
  advancingTeam?: AggregatablePlayoffSide;
};

/**
 * Rolls up a member's postseason.
 *
 * The two brackets are kept apart throughout. The playoff record is the real
 * playoffs only - a run through the sacko bracket is its own thing and is
 * reported separately, matching how appearances have always worked.
 *
 * Titles go to whoever *advanced* out of the final rather than whoever won it.
 * In the winners bracket those are the same team. In the sacko bracket they are
 * opposites: you get the sacko by scoring least, so the member Sleeper records
 * as that game's winner is precisely the one who escaped it.
 *
 * Only games flagged `countsTowardRecord` move a record, which is what keeps
 * third-place and other placement games out of it.
 */
export function aggregatePlayoffStats(
  games: AggregatablePlayoffGame[],
): Map<string, PlayoffStats> {
  const stats = new Map<string, PlayoffStats>();
  const playoffLeagues = new Map<string, Set<string>>();
  const sackoLeagues = new Map<string, Set<string>>();

  const forSide = (side: AggregatablePlayoffSide): PlayoffStats | null => {
    const userId = side?.userId;
    if (!userId) return null;

    const existing = stats.get(userId);
    if (existing) return existing;

    const created: PlayoffStats = {
      userId,
      name: side?.user?.discordName || 'Unknown',
      championships: 0,
      sackos: 0,
      appearances: 0,
      wins: 0,
      losses: 0,
      sackoAppearances: 0,
      sackoWins: 0,
      sackoLosses: 0,
    };
    stats.set(userId, created);
    playoffLeagues.set(userId, new Set());
    sackoLeagues.set(userId, new Set());
    return created;
  };

  for (const game of games) {
    const isPlayoffs = game.bracket === 'WINNERS';
    const winnerId = game.winningTeam?.userId ?? null;

    for (const side of [game.topTeam ?? null, game.bottomTeam ?? null]) {
      const entry = forSide(side);
      if (!entry) continue;

      const leagues = isPlayoffs ? playoffLeagues : sackoLeagues;
      leagues.get(entry.userId)!.add(game.leagueId);

      if (!game.countsTowardRecord || !winnerId) continue;

      const won = side!.userId === winnerId;
      if (isPlayoffs) {
        if (won) entry.wins++;
        else entry.losses++;
      } else if (won) {
        entry.sackoWins++;
      } else {
        entry.sackoLosses++;
      }
    }

    if (game.isTitleGame) {
      const decided = forSide(game.advancingTeam ?? null);
      if (decided) {
        if (isPlayoffs) decided.championships++;
        else decided.sackos++;
      }
    }
  }

  for (const [userId, leagues] of playoffLeagues) {
    stats.get(userId)!.appearances = leagues.size;
  }
  for (const [userId, leagues] of sackoLeagues) {
    stats.get(userId)!.sackoAppearances = leagues.size;
  }

  return stats;
}
