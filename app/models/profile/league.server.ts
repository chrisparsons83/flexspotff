import {
  aggregatePlayoffSeasons,
  aggregatePlayoffStats,
  computeStreak,
  medianGames,
  pairTeamGames,
  totalGames,
  winPct,
  type GameResult,
  type SeasonPlayoffLine,
} from './shared.server';
import { prisma } from '~/db.server';
import type { BracketKind } from '~/libs/bracket';

/**
 * The redraft league half of a member's profile: their career by tier, season
 * by season history, every matchup they have played, and their record against
 * each opponent.
 */

export type TierRecord = {
  tier: number;
  /** "Champions" or "Non-Champions" - a tier spans several league names. */
  label: string;
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
  /**
   * Where they finished, from the postseason brackets - "Champion", "Sacko",
   * "9th". Null until that season's bracket has been played and synced.
   */
  finish: string | null;
  place: number | null;
  /** Which bracket they were in, so the record below can be labelled. */
  playoffBracket: BracketKind | null;
  playoffWins: number;
  playoffLosses: number;
  /**
   * Head-to-head only. Sleeper folds median results into the record it reports,
   * so this is that total with the median games taken back out.
   */
  wins: number;
  losses: number;
  ties: number;
  /** Sleeper's record, median games included. */
  totalWins: number;
  totalLosses: number;
  totalTies: number;
  medianWins: number;
  medianLosses: number;
  medianTies: number;
  hasMedianScoring: boolean;
  pointsFor: number;
  /** Where that points-for placed among every team in the league that year. */
  pointsForRank: number | null;
  pointsAgainst: number;
  draftPosition: number | null;
};

export type GameLogRow = {
  year: number;
  week: number;
  leagueName: string;
  tier: number;
  isRegularSeason: boolean;
  /** Which bracket a postseason game belonged to; null in the regular season. */
  postseasonBracket: BracketKind | null;
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
  meetingCount: number;
  /** Every time they have played, oldest first. */
  meetings: { year: number; week: number; result: GameResult }[];
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
    sackos: number;
    appearances: number;
    wins: number;
    losses: number;
    sackoAppearances: number;
    sackoWins: number;
    sackoLosses: number;
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
  const years = [...new Set(teams.map(team => team.league.year))];

  // Every game in every league this member played, so opponents can be paired
  // up. Their own games alone would leave every matchup half-formed.
  const [leagueGames, everyTeamThoseYears, playoffGames] = await Promise.all([
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
    // Every team in every year this member played, which answers two things at
    // once: how big each league was, for seating its brackets, and where their
    // points-for placed against the whole site rather than just their own
    // league. Sixty rows a year, so cheaper than it looks.
    prisma.team.findMany({
      where: { league: { year: { in: years } } },
      select: {
        id: true,
        leagueId: true,
        pointsFor: true,
        league: { select: { year: true } },
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
        losingTeam: {
          select: { userId: true, user: { select: { discordName: true } } },
        },
        advancingTeam: {
          select: { userId: true, user: { select: { discordName: true } } },
        },
      },
    }),
  ]);

  const teamIds = new Set(teams.map(team => team.id));
  const mine = pairTeamGames(leagueGames).filter(
    pair =>
      teamIds.has(pair.game.teamId) &&
      // Rows are created when a week opens and only score as games finish, so
      // an untouched week would otherwise show up as a 0.00-0.00 tie in the
      // game log and in the head-to-head record.
      hasBeenPlayed(pair.game.pointsScored, pair.opponent.pointsScored),
  );

  const teamCountByLeague = new Map<string, number>();
  for (const row of everyTeamThoseYears) {
    teamCountByLeague.set(
      row.leagueId,
      (teamCountByLeague.get(row.leagueId) ?? 0) + 1,
    );
  }

  const pointsForRank = rankPointsForByYear(everyTeamThoseYears);

  const playoffSeasons =
    aggregatePlayoffSeasons(playoffGames, teamCountByLeague).get(userId) ??
    new Map();

  const gameLog: GameLogRow[] = mine
    .map(({ game, opponent, result }) => ({
      year: game.team.league.year,
      week: game.week,
      leagueName: game.team.league.name,
      tier: game.team.league.tier,
      isRegularSeason: game.isRegularSeason,
      // Every postseason game a member plays is in whichever bracket they
      // landed in, so the season's bracket labels all of them.
      postseasonBracket: game.isRegularSeason
        ? null
        : playoffSeasons.get(game.team.leagueId)?.bracket ?? null,
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
    seasons: buildSeasons(teams, playoffSeasons, pointsForRank),
    gameLog,
    headToHead: buildHeadToHead(gameLog),
    playoffs: buildPlayoffs(userId, playoffGames),
    highlights: buildHighlights(gameLog),
  };
}

/** Both sides on zero means the week has not been scored yet. */
function hasBeenPlayed(points: number, opponentPoints: number): boolean {
  return points > 0 || opponentPoints > 0;
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
      sackos: 0,
      appearances: 0,
      wins: 0,
      losses: 0,
      sackoAppearances: 0,
      sackoWins: 0,
      sackoLosses: 0,
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

/**
 * A season's head-to-head record alone. Sleeper counts the median game in the
 * record it reports, so a median season's `wins` is head-to-head plus median;
 * taking the median back out is what lets the two sit side by side without
 * double counting.
 */
function headToHeadRecord(team: ProfileTeam) {
  const counted = team.league.hasMedianScoring || medianGames(team) > 0;

  return {
    wins: team.wins - (counted ? team.medianWins : 0),
    losses: team.losses - (counted ? team.medianLosses : 0),
    ties: team.ties - (counted ? team.medianTies : 0),
  };
}

function buildCareer(teams: ProfileTeam[]): LeagueProfile['career'] {
  const career = teams.reduce(
    (acc, team) => {
      const h2h = headToHeadRecord(team);
      return {
        seasons: acc.seasons + 1,
        wins: acc.wins + h2h.wins,
        losses: acc.losses + h2h.losses,
        ties: acc.ties + h2h.ties,
        medianWins: acc.medianWins + team.medianWins,
        medianLosses: acc.medianLosses + team.medianLosses,
        medianTies: acc.medianTies + team.medianTies,
        pointsFor: acc.pointsFor + team.pointsFor,
        pointsAgainst: acc.pointsAgainst + team.pointsAgainst,
      };
    },
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
      label: tierLabel(team.league.tier),
      seasons: 0,
      wins: 0,
      losses: 0,
      ties: 0,
      winPct: 0,
      pointsFor: 0,
      pointsAgainst: 0,
    };

    const h2h = headToHeadRecord(team);
    existing.seasons++;
    existing.wins += h2h.wins;
    existing.losses += h2h.losses;
    existing.ties += h2h.ties;
    existing.pointsFor += team.pointsFor;
    existing.pointsAgainst += team.pointsAgainst;

    tiers.set(team.league.tier, existing);
  }

  return Array.from(tiers.values())
    .map(tier => ({ ...tier, winPct: winPct(tier) }))
    .sort((a, b) => a.tier - b.tier);
}

/**
 * Tier 1 is the Champions League; tier 2 is the pool of leagues a member moves
 * between below it, so a career line covering Admiral, Galaxy and Monarch
 * cannot be labelled with any one of their names.
 */
function tierLabel(tier: number): string {
  return `Tier ${tier}`;
}

/**
 * Where each team's points-for placed among every team that year.
 *
 * Across the whole site rather than within a league, because the leagues are
 * tiers of one competition - finishing third for points in Champions is not
 * the same achievement as finishing third in Dragon, and a season table that
 * ranked within the league would say they were.
 *
 * Ties share a place, so two teams on identical points are both second and the
 * next team is fourth.
 */
function rankPointsForByYear(
  rows: { id: string; pointsFor: number; league: { year: number } }[],
): Map<string, number> {
  const byYear = new Map<number, typeof rows>();
  for (const row of rows) {
    const year = byYear.get(row.league.year);
    if (year) year.push(row);
    else byYear.set(row.league.year, [row]);
  }

  const ranks = new Map<string, number>();
  for (const year of byYear.values()) {
    const sorted = [...year].sort((a, b) => b.pointsFor - a.pointsFor);
    let place = 0;
    let previous: number | null = null;

    sorted.forEach((row, index) => {
      if (previous === null || row.pointsFor !== previous) place = index + 1;
      previous = row.pointsFor;
      ranks.set(row.id, place);
    });
  }

  return ranks;
}

function buildSeasons(
  teams: ProfileTeam[],
  playoffSeasons: Map<string, SeasonPlayoffLine>,
  pointsForRank: Map<string, number>,
): SeasonRow[] {
  return teams
    .map(team => {
      const playoffs = playoffSeasons.get(team.league.id) ?? null;
      const hasMedianScoring =
        team.league.hasMedianScoring || medianGames(team) > 0;
      const h2h = headToHeadRecord(team);

      return {
        year: team.league.year,
        leagueId: team.league.id,
        leagueName: team.league.name,
        tier: team.league.tier,
        finish: playoffs?.finish ?? null,
        place: playoffs?.place ?? null,
        playoffBracket: playoffs?.bracket ?? null,
        playoffWins: playoffs?.wins ?? 0,
        playoffLosses: playoffs?.losses ?? 0,
        wins: h2h.wins,
        losses: h2h.losses,
        ties: h2h.ties,
        totalWins: team.wins,
        totalLosses: team.losses,
        totalTies: team.ties,
        medianWins: team.medianWins,
        medianLosses: team.medianLosses,
        medianTies: team.medianTies,
        hasMedianScoring,
        pointsFor: team.pointsFor,
        pointsForRank: pointsForRank.get(team.id) ?? null,
        pointsAgainst: team.pointsAgainst,
        draftPosition: team.draftPosition,
      };
    })
    .sort((a, b) => b.year - a.year);
}

function buildHeadToHead(gameLog: GameLogRow[]): HeadToHeadRow[] {
  const opponents = new Map<string, HeadToHeadRow>();

  for (const game of gameLog) {
    if (!game.opponentUserId) continue;

    const existing = opponents.get(game.opponentUserId) ?? {
      opponentUserId: game.opponentUserId,
      opponentName: game.opponentName,
      wins: 0,
      losses: 0,
      ties: 0,
      meetingCount: 0,
      meetings: [],
    };

    if (game.result === 'W') existing.wins++;
    else if (game.result === 'L') existing.losses++;
    else existing.ties++;

    existing.meetingCount++;
    existing.meetings.push({
      year: game.year,
      week: game.week,
      result: game.result,
    });

    opponents.set(game.opponentUserId, existing);
  }

  return Array.from(opponents.values())
    .map(row => ({
      ...row,
      // The game log runs newest first; a list of meetings reads better the
      // other way round.
      meetings: [...row.meetings].sort(
        (a, b) => a.year - b.year || a.week - b.week,
      ),
    }))
    .sort((a, b) => b.meetingCount - a.meetingCount || b.wins - a.wins);
}

type PlayoffGameRow = Parameters<typeof aggregatePlayoffStats>[0][number];

function buildPlayoffs(
  userId: string,
  playoffGames: PlayoffGameRow[],
): LeagueProfile['playoffs'] {
  const stats = aggregatePlayoffStats(playoffGames).get(userId);

  return {
    championships: stats?.championships ?? 0,
    sackos: stats?.sackos ?? 0,
    appearances: stats?.appearances ?? 0,
    wins: stats?.wins ?? 0,
    losses: stats?.losses ?? 0,
    sackoAppearances: stats?.sackoAppearances ?? 0,
    sackoWins: stats?.sackoWins ?? 0,
    sackoLosses: stats?.sackoLosses ?? 0,
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
