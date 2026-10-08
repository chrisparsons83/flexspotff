import {
  aggregatePlayoffSeasons,
  averagePerSeason,
  aggregatePlayoffStats,
  buildLeagueHighlights,
  medianGames,
  settledLeagueGames,
  totalGames,
  winPct,
  type GameResult,
  type LeagueHighlights,
  type SeasonPlayoffLine,
} from './shared.server';
import { prisma } from '~/db.server';
import type { BracketKind } from '~/libs/bracket';
import { getSeasonState, type SeasonState } from '~/models/seasonState.server';
import { assignCompetitionRanks } from '~/utils/rank';
import { regularSeasonIsOver } from '~/utils/seasonStructure';

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
  /**
   * Finished seasons only - a season a few weeks old would drag the average
   * down to a fraction of a real one. Null until the tier has a finished
   * season to average.
   */
  pointsForPerSeason: number | null;
  pointsAgainstPerSeason: number | null;
  /** Whether the season being played is one of `seasons`. */
  includesCurrentSeason: boolean;
};

export type SeasonRow = {
  year: number;
  leagueId: string;
  leagueName: string;
  tier: number;
  /** The season still being played. */
  inProgress: boolean;
  /**
   * Where they stand in their league's table right now, while the season is
   * being played. Null once it is over - `finish` says where it ended.
   */
  standing: { place: number; fieldSize: number } | null;
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
    /** Sleeper's record, median games included. */
    wins: number;
    losses: number;
    ties: number;
    winPct: number;
    h2hWins: number;
    h2hLosses: number;
    h2hTies: number;
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
  highlights: LeagueHighlights;
};

export async function getLeagueProfile(userId: string): Promise<LeagueProfile> {
  const [teams, state] = await Promise.all([
    prisma.team.findMany({
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
    }),
    getSeasonState(),
  ]);

  if (teams.length === 0) {
    return emptyProfile();
  }

  const leagueIds = teams.map(team => team.league.id);
  const years = [...new Set(teams.map(team => team.league.year))];

  // Every game in every league this member played, so opponents can be paired
  // up. Their own games alone would leave every matchup half-formed.
  const [leagueGames, everyTeamThoseYears, allPlayoffGames] = await Promise.all(
    [
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
      // Every team in every year this member played, which answers three things
      // at once: how big each league was, for seating its brackets, where their
      // points-for placed against the whole site rather than just their own
      // league, and where they stand in a season still being played. Sixty rows
      // a year, so cheaper than it looks.
      prisma.team.findMany({
        where: { league: { year: { in: years } } },
        select: {
          id: true,
          leagueId: true,
          wins: true,
          losses: true,
          ties: true,
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
          league: { select: { year: true, playoffWeekStart: true } },
        },
      }),
    ],
  );

  // A bracket means nothing until the regular season it seeds from is over,
  // so nothing in one is shown before then - no finish, no playoff or sacko
  // label, no postseason record.
  const playoffGames = allPlayoffGames.filter(game =>
    regularSeasonIsOver(game.league, state),
  );

  const teamIds = new Set(teams.map(team => team.id));
  const mine = settledLeagueGames(leagueGames, state).filter(pair =>
    teamIds.has(pair.game.teamId),
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
    byTier: buildTierRecords(teams, state),
    seasons: buildSeasons(teams, {
      state,
      playoffSeasons,
      pointsForRank,
      // Only the season being played shows a standing; every other season
      // has a finish instead.
      standings: rankStandings(
        everyTeamThoseYears.filter(
          row => row.league.year === state.inProgressYear,
        ),
      ),
    }),
    gameLog,
    headToHead: buildHeadToHead(gameLog),
    playoffs: buildPlayoffs(userId, playoffGames),
    highlights: buildLeagueHighlights(gameLog),
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
      h2hWins: 0,
      h2hLosses: 0,
      h2hTies: 0,
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

export type ProfileTeam = {
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
        wins: acc.wins + team.wins,
        losses: acc.losses + team.losses,
        ties: acc.ties + team.ties,
        h2hWins: acc.h2hWins + h2h.wins,
        h2hLosses: acc.h2hLosses + h2h.losses,
        h2hTies: acc.h2hTies + h2h.ties,
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
      h2hWins: 0,
      h2hLosses: 0,
      h2hTies: 0,
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

export function buildTierRecords(
  teams: ProfileTeam[],
  state: SeasonState,
): TierRecord[] {
  const tiers = new Map<
    number,
    TierRecord & {
      finishedSeasons: number;
      finishedPointsFor: number;
      finishedPointsAgainst: number;
    }
  >();

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
      pointsForPerSeason: null,
      pointsAgainstPerSeason: null,
      includesCurrentSeason: false,
      finishedSeasons: 0,
      finishedPointsFor: 0,
      finishedPointsAgainst: 0,
    };

    // The record Sleeper reports, median games included - in a median season
    // those count in the standings exactly like the head-to-head game does.
    existing.seasons++;
    existing.wins += team.wins;
    existing.losses += team.losses;
    existing.ties += team.ties;
    existing.pointsFor += team.pointsFor;
    existing.pointsAgainst += team.pointsAgainst;

    if (team.league.year === state.inProgressYear) {
      existing.includesCurrentSeason = true;
    } else {
      existing.finishedSeasons++;
      existing.finishedPointsFor += team.pointsFor;
      existing.finishedPointsAgainst += team.pointsAgainst;
    }

    tiers.set(team.league.tier, existing);
  }

  return Array.from(tiers.values())
    .map(
      ({
        finishedSeasons,
        finishedPointsFor,
        finishedPointsAgainst,
        ...tier
      }) => ({
        ...tier,
        winPct: winPct(tier),
        pointsForPerSeason:
          finishedSeasons > 0
            ? averagePerSeason(finishedPointsFor, finishedSeasons)
            : null,
        pointsAgainstPerSeason:
          finishedSeasons > 0
            ? averagePerSeason(finishedPointsAgainst, finishedSeasons)
            : null,
      }),
    )
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
  const ranks = new Map<string, number>();
  for (const year of groupBy(rows, row => row.league.year)) {
    const sorted = [...year].sort((a, b) => b.pointsFor - a.pointsFor);
    for (const row of assignCompetitionRanks(sorted, row => row.pointsFor)) {
      ranks.set(row.id, row.rank);
    }
  }

  return ranks;
}

/**
 * Sleeper's win percentage, which counts a tie as half a win. `winPct` counts
 * it as no win at all, which would put a 5-0-1 team behind a 5-1-0 one.
 */
const standingsPct = (row: { wins: number; losses: number; ties: number }) => {
  const games = totalGames(row);
  return games > 0 ? (row.wins + row.ties / 2) / games : 0;
};

/**
 * Where each team stands in its own league's table: win percentage first, as
 * Sleeper orders it, then points for. Ties on both share a place.
 */
export function rankStandings(
  rows: {
    id: string;
    leagueId: string;
    wins: number;
    losses: number;
    ties: number;
    pointsFor: number;
  }[],
): Map<string, { place: number; fieldSize: number }> {
  const standings = new Map<string, { place: number; fieldSize: number }>();
  for (const league of groupBy(rows, row => row.leagueId)) {
    const sorted = [...league].sort(
      (a, b) => standingsPct(b) - standingsPct(a) || b.pointsFor - a.pointsFor,
    );
    const ranked = assignCompetitionRanks(sorted, row => [
      standingsPct(row),
      row.pointsFor,
    ]);
    for (const row of ranked) {
      standings.set(row.id, { place: row.rank, fieldSize: league.length });
    }
  }

  return standings;
}

function groupBy<T, K>(rows: T[], keyOf: (row: T) => K): T[][] {
  const groups = new Map<K, T[]>();
  for (const row of rows) {
    const key = keyOf(row);
    const group = groups.get(key);
    if (group) group.push(row);
    else groups.set(key, [row]);
  }
  return [...groups.values()];
}

function buildSeasons(
  teams: ProfileTeam[],
  {
    state,
    playoffSeasons,
    pointsForRank,
    standings,
  }: {
    state: SeasonState;
    playoffSeasons: Map<string, SeasonPlayoffLine>;
    pointsForRank: Map<string, number>;
    standings: Map<string, { place: number; fieldSize: number }>;
  },
): SeasonRow[] {
  return teams
    .map(team => {
      const inProgress = team.league.year === state.inProgressYear;
      const playoffs = playoffSeasons.get(team.league.id) ?? null;
      const hasMedianScoring =
        team.league.hasMedianScoring || medianGames(team) > 0;
      const h2h = headToHeadRecord(team);

      return {
        year: team.league.year,
        leagueId: team.league.id,
        leagueName: team.league.name,
        tier: team.league.tier,
        inProgress,
        // A table with nobody having played yet ranks nothing.
        standing:
          inProgress && totalGames(team) > 0
            ? standings.get(team.id) ?? null
            : null,
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

export { totalGames };
