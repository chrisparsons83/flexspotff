import {
  aggregatePlayoffStats,
  computeStreak,
  medianGames,
  pairTeamGames,
  totalGames,
  winPct,
  type GameResult,
} from './shared.server';
import { prisma } from '~/db.server';

/**
 * The redraft league half of a member's profile: their career by tier, season
 * by season history, every matchup they have played, and their record against
 * each opponent.
 */

export type TierRecord = {
  tier: number;
  leagueName: string;
  seasons: number;
  wins: number;
  losses: number;
  ties: number;
  winPct: number;
  pointsFor: number;
  pointsAgainst: number;
};

export type SeasonRow = {
  year: number;
  leagueId: string;
  leagueName: string;
  tier: number;
  rank: number | null;
  teamCount: number;
  wins: number;
  losses: number;
  ties: number;
  medianWins: number;
  medianLosses: number;
  medianTies: number;
  hasMedianScoring: boolean;
  pointsFor: number;
  pointsAgainst: number;
  draftPosition: number | null;
  /** Movement from the previous season they played: negative is a promotion. */
  tierChange: number | null;
};

export type GameLogRow = {
  year: number;
  week: number;
  leagueName: string;
  tier: number;
  isRegularSeason: boolean;
  pointsScored: number;
  opponentPoints: number;
  opponentUserId: string | null;
  opponentName: string;
  result: GameResult;
};

export type HeadToHeadRow = {
  opponentUserId: string;
  opponentName: string;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  meetings: number;
  years: number[];
};

export type LeagueProfile = {
  hasPlayed: boolean;
  career: {
    seasons: number;
    wins: number;
    losses: number;
    ties: number;
    winPct: number;
    medianWins: number;
    medianLosses: number;
    medianTies: number;
    pointsFor: number;
    pointsAgainst: number;
    /**
     * True when at least one season counted median games, which is when a
     * combined record is meaningful. Seasons that predate median scoring are
     * never folded into one.
     */
    hasAnyMedianSeason: boolean;
  };
  byTier: TierRecord[];
  seasons: SeasonRow[];
  gameLog: GameLogRow[];
  headToHead: HeadToHeadRow[];
  playoffs: {
    championships: number;
    toiletBowls: number;
    appearances: number;
    wins: number;
    losses: number;
  };
  highlights: {
    bestWeek: { points: number; year: number; week: number } | null;
    worstWeek: { points: number; year: number; week: number } | null;
    longestWinStreak: number;
    longestLossStreak: number;
    averagePointsPerGame: number;
  };
};

export async function getLeagueProfile(userId: string): Promise<LeagueProfile> {
  const teams = await prisma.team.findMany({
    where: { userId },
    include: {
      league: {
        select: {
          id: true,
          year: true,
          name: true,
          tier: true,
          hasMedianScoring: true,
        },
      },
    },
  });

  if (teams.length === 0) {
    return emptyProfile();
  }

  const leagueIds = teams.map(team => team.league.id);

  // Every game in every league this member played, so opponents can be paired
  // up. Their own games alone would leave every matchup half-formed.
  const [leagueGames, standings, playoffGames] = await Promise.all([
    prisma.teamGame.findMany({
      where: { team: { leagueId: { in: leagueIds } } },
      include: {
        team: {
          select: {
            id: true,
            leagueId: true,
            userId: true,
            user: { select: { discordName: true } },
            league: { select: { year: true, name: true, tier: true } },
          },
        },
      },
    }),
    prisma.team.findMany({
      where: { leagueId: { in: leagueIds } },
      select: {
        id: true,
        leagueId: true,
        userId: true,
        wins: true,
        ties: true,
        pointsFor: true,
      },
    }),
    prisma.playoffGame.findMany({
      where: { league: { teams: { some: { userId } } } },
      include: {
        topTeam: {
          select: { userId: true, user: { select: { discordName: true } } },
        },
        bottomTeam: {
          select: { userId: true, user: { select: { discordName: true } } },
        },
        winningTeam: {
          select: { userId: true, user: { select: { discordName: true } } },
        },
      },
    }),
  ]);

  const teamIds = new Set(teams.map(team => team.id));
  const mine = pairTeamGames(leagueGames).filter(pair =>
    teamIds.has(pair.game.teamId),
  );

  const gameLog: GameLogRow[] = mine
    .map(({ game, opponent, result }) => ({
      year: game.team.league.year,
      week: game.week,
      leagueName: game.team.league.name,
      tier: game.team.league.tier,
      isRegularSeason: game.isRegularSeason,
      pointsScored: game.pointsScored,
      opponentPoints: opponent.pointsScored,
      opponentUserId: opponent.team.userId,
      opponentName: opponent.team.user?.discordName || 'Unknown',
      result,
    }))
    .sort((a, b) => b.year - a.year || b.week - a.week);

  return {
    hasPlayed: true,
    career: buildCareer(teams),
    byTier: buildTierRecords(teams),
    seasons: buildSeasons(teams, standings),
    gameLog,
    headToHead: buildHeadToHead(gameLog),
    playoffs: buildPlayoffs(userId, playoffGames),
    highlights: buildHighlights(gameLog),
  };
}

function emptyProfile(): LeagueProfile {
  return {
    hasPlayed: false,
    career: {
      seasons: 0,
      wins: 0,
      losses: 0,
      ties: 0,
      winPct: 0,
      medianWins: 0,
      medianLosses: 0,
      medianTies: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      hasAnyMedianSeason: false,
    },
    byTier: [],
    seasons: [],
    gameLog: [],
    headToHead: [],
    playoffs: {
      championships: 0,
      toiletBowls: 0,
      appearances: 0,
      wins: 0,
      losses: 0,
    },
    highlights: {
      bestWeek: null,
      worstWeek: null,
      longestWinStreak: 0,
      longestLossStreak: 0,
      averagePointsPerGame: 0,
    },
  };
}

type ProfileTeam = {
  wins: number;
  losses: number;
  ties: number;
  medianWins: number;
  medianLosses: number;
  medianTies: number;
  pointsFor: number;
  pointsAgainst: number;
  draftPosition: number | null;
  id: string;
  league: {
    id: string;
    year: number;
    name: string;
    tier: number;
    hasMedianScoring: boolean;
  };
};

function buildCareer(teams: ProfileTeam[]): LeagueProfile['career'] {
  const career = teams.reduce(
    (acc, team) => ({
      seasons: acc.seasons + 1,
      wins: acc.wins + team.wins,
      losses: acc.losses + team.losses,
      ties: acc.ties + team.ties,
      medianWins: acc.medianWins + team.medianWins,
      medianLosses: acc.medianLosses + team.medianLosses,
      medianTies: acc.medianTies + team.medianTies,
      pointsFor: acc.pointsFor + team.pointsFor,
      pointsAgainst: acc.pointsAgainst + team.pointsAgainst,
    }),
    {
      seasons: 0,
      wins: 0,
      losses: 0,
      ties: 0,
      medianWins: 0,
      medianLosses: 0,
      medianTies: 0,
      pointsFor: 0,
      pointsAgainst: 0,
    },
  );

  return {
    ...career,
    winPct: winPct(career),
    hasAnyMedianSeason: teams.some(
      team => team.league.hasMedianScoring || medianGames(team) > 0,
    ),
  };
}

function buildTierRecords(teams: ProfileTeam[]): TierRecord[] {
  const tiers = new Map<number, TierRecord>();

  for (const team of teams) {
    const existing = tiers.get(team.league.tier) ?? {
      tier: team.league.tier,
      leagueName: team.league.name,
      seasons: 0,
      wins: 0,
      losses: 0,
      ties: 0,
      winPct: 0,
      pointsFor: 0,
      pointsAgainst: 0,
    };

    existing.seasons++;
    existing.wins += team.wins;
    existing.losses += team.losses;
    existing.ties += team.ties;
    existing.pointsFor += team.pointsFor;
    existing.pointsAgainst += team.pointsAgainst;

    tiers.set(team.league.tier, existing);
  }

  return Array.from(tiers.values())
    .map(tier => ({ ...tier, winPct: winPct(tier) }))
    .sort((a, b) => a.tier - b.tier);
}

type StandingRow = {
  id: string;
  leagueId: string;
  userId: string | null;
  wins: number;
  ties: number;
  pointsFor: number;
};

/**
 * Final placing is not stored, so it is recomputed the same way the standings
 * page orders a league: wins, then ties, then points for.
 */
function buildSeasons(
  teams: ProfileTeam[],
  standings: StandingRow[],
): SeasonRow[] {
  const byLeague = new Map<string, StandingRow[]>();
  for (const row of standings) {
    const existing = byLeague.get(row.leagueId);
    if (existing) {
      existing.push(row);
    } else {
      byLeague.set(row.leagueId, [row]);
    }
  }

  for (const rows of byLeague.values()) {
    rows.sort(
      (a, b) => b.wins - a.wins || b.ties - a.ties || b.pointsFor - a.pointsFor,
    );
  }

  const ordered = [...teams].sort((a, b) => a.league.year - b.league.year);

  return ordered
    .map((team, index) => {
      const leagueRows = byLeague.get(team.league.id) ?? [];
      const position = leagueRows.findIndex(row => row.id === team.id);
      const previous = index > 0 ? ordered[index - 1] : null;

      return {
        year: team.league.year,
        leagueId: team.league.id,
        leagueName: team.league.name,
        tier: team.league.tier,
        rank: position >= 0 ? position + 1 : null,
        teamCount: leagueRows.length,
        wins: team.wins,
        losses: team.losses,
        ties: team.ties,
        medianWins: team.medianWins,
        medianLosses: team.medianLosses,
        medianTies: team.medianTies,
        hasMedianScoring: team.league.hasMedianScoring || medianGames(team) > 0,
        pointsFor: team.pointsFor,
        pointsAgainst: team.pointsAgainst,
        draftPosition: team.draftPosition,
        tierChange: previous ? team.league.tier - previous.league.tier : null,
      };
    })
    .sort((a, b) => b.year - a.year);
}

function buildHeadToHead(gameLog: GameLogRow[]): HeadToHeadRow[] {
  const opponents = new Map<string, HeadToHeadRow & { yearSet: Set<number> }>();

  for (const game of gameLog) {
    if (!game.opponentUserId) continue;

    const existing = opponents.get(game.opponentUserId) ?? {
      opponentUserId: game.opponentUserId,
      opponentName: game.opponentName,
      wins: 0,
      losses: 0,
      ties: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      meetings: 0,
      years: [],
      yearSet: new Set<number>(),
    };

    if (game.result === 'W') existing.wins++;
    else if (game.result === 'L') existing.losses++;
    else existing.ties++;

    existing.pointsFor += game.pointsScored;
    existing.pointsAgainst += game.opponentPoints;
    existing.meetings++;
    existing.yearSet.add(game.year);

    opponents.set(game.opponentUserId, existing);
  }

  return Array.from(opponents.values())
    .map(({ yearSet, ...row }) => ({
      ...row,
      years: Array.from(yearSet).sort((a, b) => a - b),
    }))
    .sort((a, b) => b.meetings - a.meetings || b.wins - a.wins);
}

type PlayoffGameRow = Parameters<typeof aggregatePlayoffStats>[0][number];

function buildPlayoffs(
  userId: string,
  playoffGames: PlayoffGameRow[],
): LeagueProfile['playoffs'] {
  const stats = aggregatePlayoffStats(playoffGames).get(userId);

  return {
    championships: stats?.championships ?? 0,
    toiletBowls: stats?.toiletBowls ?? 0,
    appearances: stats?.appearances ?? 0,
    wins: stats?.wins ?? 0,
    losses: stats?.losses ?? 0,
  };
}

function buildHighlights(gameLog: GameLogRow[]): LeagueProfile['highlights'] {
  // A zero is an unplayed week rather than a historically bad one.
  const played = gameLog.filter(game => game.pointsScored > 0);

  if (played.length === 0) {
    return {
      bestWeek: null,
      worstWeek: null,
      longestWinStreak: 0,
      longestLossStreak: 0,
      averagePointsPerGame: 0,
    };
  }

  const best = played.reduce((a, b) =>
    b.pointsScored > a.pointsScored ? b : a,
  );
  const worst = played.reduce((a, b) =>
    b.pointsScored < a.pointsScored ? b : a,
  );

  // Streaks run forward through time; the game log is newest first.
  const chronological = [...played].sort(
    (a, b) => a.year - b.year || a.week - b.week,
  );

  return {
    bestWeek: {
      points: best.pointsScored,
      year: best.year,
      week: best.week,
    },
    worstWeek: {
      points: worst.pointsScored,
      year: worst.year,
      week: worst.week,
    },
    longestWinStreak:
      computeStreak(chronological, game => game.result === 'W')?.length ?? 0,
    longestLossStreak:
      computeStreak(chronological, game => game.result === 'L')?.length ?? 0,
    averagePointsPerGame:
      played.reduce((sum, game) => sum + game.pointsScored, 0) / played.length,
  };
}

export { totalGames };
