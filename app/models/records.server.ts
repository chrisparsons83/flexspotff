import { getUnfinalizedWeeks } from './nflgame.server';
import { prisma } from '~/db.server';
import { regularSeasonLastWeek } from '~/utils/constants';

const TOP_N = 50;
const MIN_SEASONS = 2;
const HUNDRED_POINT_THRESHOLD = 100;

export type RecordRow = {
  cells: string[];
  leagueName?: string;
  /**
   * 1-based position, with ties sharing a rank (1, 2, 2, 4). Falls back to the
   * row index in the table component when absent.
   */
  rank?: number;
};

export type RecordTable = {
  title: string;
  headers: string[];
  rows: RecordRow[];
};

export type RecordCategories = {
  careerRecords: RecordTable[];
  singleSeasonRecords: RecordTable[];
  singleGameRecords: RecordTable[];
  cupRecords: RecordTable[];
  streakRecords: RecordTable[];
};

/**
 * A single team-season. `wins`/`losses`/`ties` come from Sleeper and, per league
 * rule 9.5, already include the weekly median game, so they are combined
 * H2H + median records. `medianWins`/`medianLosses`/`medianTies` are the median
 * portion of that same total, not a separate set of games.
 *
 * Points are deliberately absent: Sleeper's season totals cover whichever weeks
 * it counts, which may include the playoffs, so every points record on the page
 * is summed from the regular season games themselves instead.
 */
export type RecordsTeam = {
  id: string;
  userId: string;
  userName: string;
  leagueId: string;
  leagueName: string;
  year: number;
  wins: number;
  losses: number;
  ties: number;
  medianWins: number;
  medianLosses: number;
  medianTies: number;
};

export type RecordsGame = {
  teamId: string;
  week: number;
  sleeperMatchupId: number;
  pointsScored: number;
};

export type RecordsCupUser = {
  userId: string;
  userName: string;
};

export type RecordsCupGame = {
  round: string;
  /** Byes are auto-advanced with a winner set, but nobody played them. */
  containsBye: boolean;
  /**
   * Both bracket slots were filled. A decided game missing one is a walkover -
   * an unfilled slot still scores as 0 - so it is not a game either. Tracked
   * separately from the users below, which are null for an unlinked owner.
   */
  isContested: boolean;
  topUser: RecordsCupUser | null;
  bottomUser: RecordsCupUser | null;
  winningUser: RecordsCupUser | null;
};

export type RecordsInput = {
  teams: RecordsTeam[];
  games: RecordsGame[];
  cupGames: RecordsCupGame[];
  /** True once every NFL game in that year/week has finished. */
  isWeekFinal: (year: number, week: number) => boolean;
};

type GameResult = 'W' | 'L' | 'T';

type WeekSummary = {
  pointsScored: number;
  /** Null when the week has no usable head-to-head matchup. */
  headToHead: GameResult | null;
  /** Null for leagues that predate median scoring. */
  median: GameResult | null;
};

type TeamSeason = {
  team: RecordsTeam;
  /** Weeks the team actually posted a score in a finished week. */
  hasPlayed: boolean;
  /** The league reached its final regular season week. */
  isSeasonComplete: boolean;
  regularSeasonPointsFor: number;
  headToHeadPointsAgainst: number;
  weeks: Map<number, WeekSummary>;
};

/** Sequence entries are null where the streak must break (unplayed week). */
type StreakEntry<T> = (T & { week: number }) | null;

type StreakInfo = {
  userName: string;
  year: number;
  leagueName: string;
  length: number;
  startWeek: number;
  endWeek: number;
};

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
};

const resultOf = (score: number, opponentScore: number): GameResult =>
  score > opponentScore ? 'W' : score < opponentScore ? 'L' : 'T';

/**
 * Assigns competition ranks, so rows sharing a displayed value share a rank and
 * the next distinct value skips ahead (1, 2, 2, 4).
 */
function withRanks(
  entries: { key: string; row: Omit<RecordRow, 'rank'> }[],
): RecordRow[] {
  let previousKey: string | null = null;
  let previousRank = 0;

  return entries.map((entry, index) => {
    if (entry.key !== previousKey) {
      previousKey = entry.key;
      previousRank = index + 1;
    }

    return { ...entry.row, rank: previousRank };
  });
}

/**
 * Longest run of entries satisfying `predicate`. A null entry is a week with no
 * result (not yet played, or no usable matchup) and always breaks the run,
 * rather than being skipped over.
 */
function computeStreak<T>(
  entries: StreakEntry<T>[],
  predicate: (entry: T & { week: number }) => boolean,
): { length: number; startWeek: number; endWeek: number } | null {
  let maxLength = 0;
  let maxStartWeek = 0;
  let maxEndWeek = 0;
  let currentLength = 0;
  let currentStartWeek = 0;

  for (const entry of entries) {
    if (entry && predicate(entry)) {
      if (currentLength === 0) currentStartWeek = entry.week;
      currentLength++;

      if (currentLength > maxLength) {
        maxLength = currentLength;
        maxStartWeek = currentStartWeek;
        maxEndWeek = entry.week;
      }
    } else {
      currentLength = 0;
    }
  }

  if (maxLength === 0) return null;

  return { length: maxLength, startWeek: maxStartWeek, endWeek: maxEndWeek };
}

/**
 * Turns raw team/game rows into per-team-season summaries, dropping anything
 * that has not actually been played: weeks whose NFL games are still in
 * progress, and team-seasons that have not started at all (teams are created at
 * draft time, so the upcoming season is already in the database with an empty
 * record).
 */
function buildTeamSeasons(
  teams: RecordsTeam[],
  games: RecordsGame[],
  isWeekFinal: (year: number, week: number) => boolean,
): TeamSeason[] {
  const teamsById = new Map(teams.map(team => [team.id, team]));

  // Only the current week of the current season has its NFL game statuses
  // refreshed (jobs/monitor-nfl-games), so a status left stale by a missed sync
  // would exclude that week forever. Earlier seasons are finished by
  // definition, so only the newest one is checked for games still in progress.
  const latestYear = teams.reduce(
    (latest, team) => Math.max(latest, team.year),
    0,
  );
  const isPlayedWeek = (year: number, week: number) =>
    year < latestYear || isWeekFinal(year, week);

  // Median scoring did not always exist. A league that recorded no median
  // results anywhere played head-to-head only.
  const leagueHasMedian = new Map<string, boolean>();
  for (const team of teams) {
    const hasMedian = team.medianWins + team.medianLosses + team.medianTies > 0;
    leagueHasMedian.set(
      team.leagueId,
      (leagueHasMedian.get(team.leagueId) ?? false) || hasMedian,
    );
  }

  // League -> week -> games, restricted to finished regular season weeks.
  const leagueWeeks = new Map<string, Map<number, RecordsGame[]>>();
  for (const game of games) {
    const team = teamsById.get(game.teamId);
    if (!team) continue;
    if (game.week > regularSeasonLastWeek(team.year)) continue;
    if (!isPlayedWeek(team.year, game.week)) continue;

    let weeks = leagueWeeks.get(team.leagueId);
    if (!weeks) {
      weeks = new Map();
      leagueWeeks.set(team.leagueId, weeks);
    }

    const weekGames = weeks.get(game.week);
    if (weekGames) {
      weekGames.push(game);
    } else {
      weeks.set(game.week, [game]);
    }
  }

  const seasons = new Map<string, TeamSeason>();
  for (const team of teams) {
    seasons.set(team.id, {
      team,
      hasPlayed: false,
      isSeasonComplete: false,
      regularSeasonPointsFor: 0,
      headToHeadPointsAgainst: 0,
      weeks: new Map(),
    });
  }

  for (const [leagueId, weeks] of leagueWeeks) {
    const hasMedian = leagueHasMedian.get(leagueId) ?? false;

    for (const [week, weekGames] of weeks) {
      // Rule 9.5: the median of a 12-team league is the mean of the 6th and 7th
      // place scores, i.e. the mean of the two middle scores for an even field.
      const weekMedian = hasMedian
        ? median(weekGames.map(game => game.pointsScored))
        : null;

      // Matchup ids collide when Sleeper returns none (the sync stores -1), so
      // only groups that are exactly a pair produce a head-to-head result.
      const matchups = new Map<number, RecordsGame[]>();
      for (const game of weekGames) {
        const matchup = matchups.get(game.sleeperMatchupId);
        if (matchup) {
          matchup.push(game);
        } else {
          matchups.set(game.sleeperMatchupId, [game]);
        }
      }

      const opponents = new Map<string, RecordsGame>();
      for (const matchup of matchups.values()) {
        if (matchup.length !== 2) continue;
        const [first, second] = matchup;
        opponents.set(first.teamId, second);
        opponents.set(second.teamId, first);
      }

      for (const game of weekGames) {
        const season = seasons.get(game.teamId);
        if (!season) continue;
        // There is no unique constraint on team/week, so ignore any duplicate
        // rather than counting its points twice.
        if (season.weeks.has(week)) continue;

        const opponent = opponents.get(game.teamId) ?? null;

        season.weeks.set(week, {
          pointsScored: game.pointsScored,
          headToHead: opponent
            ? resultOf(game.pointsScored, opponent.pointsScored)
            : null,
          median:
            weekMedian !== null
              ? resultOf(game.pointsScored, weekMedian)
              : null,
        });

        season.regularSeasonPointsFor += game.pointsScored;
        if (opponent) season.headToHeadPointsAgainst += opponent.pointsScored;
        if (game.pointsScored > 0) season.hasPlayed = true;
      }
    }
  }

  // A season counts as complete once its league has a finished final week.
  const leagueMaxWeek = new Map<string, number>();
  for (const [leagueId, weeks] of leagueWeeks) {
    leagueMaxWeek.set(leagueId, Math.max(...weeks.keys()));
  }

  for (const season of seasons.values()) {
    const maxWeek = leagueMaxWeek.get(season.team.leagueId) ?? 0;
    season.isSeasonComplete =
      maxWeek >= regularSeasonLastWeek(season.team.year);
  }

  return [...seasons.values()].filter(season => season.hasPlayed);
}

function buildCareerRecords(seasons: TeamSeason[]): RecordTable[] {
  interface CareerStats {
    name: string;
    seasons: number;
    wins: number;
    losses: number;
    ties: number;
    pointsFor: number;
    pointsAgainst: number;
    medianWins: number;
    medianLosses: number;
    medianTies: number;
    // Rate stats are only meaningful over finished seasons, otherwise a hot
    // start to the current year distorts them.
    completedSeasons: number;
    completedWins: number;
    completedLosses: number;
    completedTies: number;
    completedPointsFor: number;
  }

  const map = new Map<string, CareerStats>();

  for (const {
    team,
    isSeasonComplete,
    regularSeasonPointsFor,
    headToHeadPointsAgainst,
  } of seasons) {
    const existing = map.get(team.userId) || {
      name: team.userName,
      seasons: 0,
      wins: 0,
      losses: 0,
      ties: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      medianWins: 0,
      medianLosses: 0,
      medianTies: 0,
      completedSeasons: 0,
      completedWins: 0,
      completedLosses: 0,
      completedTies: 0,
      completedPointsFor: 0,
    };

    existing.seasons++;
    existing.wins += team.wins;
    existing.losses += team.losses;
    existing.ties += team.ties;
    existing.pointsFor += regularSeasonPointsFor;
    existing.pointsAgainst += headToHeadPointsAgainst;
    existing.medianWins += team.medianWins;
    existing.medianLosses += team.medianLosses;
    existing.medianTies += team.medianTies;

    if (isSeasonComplete) {
      existing.completedSeasons++;
      existing.completedWins += team.wins;
      existing.completedLosses += team.losses;
      existing.completedTies += team.ties;
      existing.completedPointsFor += regularSeasonPointsFor;
    }

    map.set(team.userId, existing);
  }

  const careers = [...map.values()];

  const completedGames = (c: CareerStats) =>
    c.completedWins + c.completedLosses + c.completedTies;
  const winPct = (c: CareerStats) =>
    completedGames(c) > 0 ? c.completedWins / completedGames(c) : 0;
  const avgPF = (c: CareerStats) =>
    c.completedSeasons > 0 ? c.completedPointsFor / c.completedSeasons : 0;
  const byName = (a: CareerStats, b: CareerStats) =>
    a.name.localeCompare(b.name);

  return [
    {
      title: 'Most Career Wins',
      headers: ['Player', 'Wins', 'Record', 'Seasons'],
      rows: withRanks(
        [...careers]
          .sort(
            (a, b) => b.wins - a.wins || a.losses - b.losses || byName(a, b),
          )
          .slice(0, TOP_N)
          .map(c => ({
            key: c.wins.toString(),
            row: {
              cells: [
                c.name,
                c.wins.toString(),
                `${c.wins}-${c.losses}-${c.ties}`,
                c.seasons.toString(),
              ],
            },
          })),
      ),
    },
    {
      title: 'Highest Career Win Percentage (completed seasons)',
      headers: ['Player', 'Win %', 'Record', 'Seasons'],
      rows: withRanks(
        careers
          .filter(c => c.completedSeasons >= MIN_SEASONS)
          .sort(
            (a, b) =>
              winPct(b) - winPct(a) ||
              completedGames(b) - completedGames(a) ||
              byName(a, b),
          )
          .slice(0, TOP_N)
          .map(c => ({
            key: (winPct(c) * 100).toFixed(1),
            row: {
              cells: [
                c.name,
                (winPct(c) * 100).toFixed(1) + '%',
                `${c.completedWins}-${c.completedLosses}-${c.completedTies}`,
                c.completedSeasons.toString(),
              ],
            },
          })),
      ),
    },
    {
      title: 'Most Career Points For (regular season)',
      headers: ['Player', 'Points For', 'Seasons'],
      rows: withRanks(
        [...careers]
          .sort((a, b) => b.pointsFor - a.pointsFor || byName(a, b))
          .slice(0, TOP_N)
          .map(c => ({
            key: c.pointsFor.toFixed(2),
            row: {
              cells: [c.name, c.pointsFor.toFixed(2), c.seasons.toString()],
            },
          })),
      ),
    },
    {
      title: 'Most Career Points Against (regular season, head-to-head)',
      headers: ['Player', 'Points Against', 'Seasons'],
      rows: withRanks(
        [...careers]
          .sort((a, b) => b.pointsAgainst - a.pointsAgainst || byName(a, b))
          .slice(0, TOP_N)
          .map(c => ({
            key: c.pointsAgainst.toFixed(2),
            row: {
              cells: [c.name, c.pointsAgainst.toFixed(2), c.seasons.toString()],
            },
          })),
      ),
    },
    {
      title: 'Highest Average Points For per Season (completed seasons)',
      headers: ['Player', 'Avg PF/Season', 'Total PF', 'Seasons'],
      rows: withRanks(
        careers
          .filter(c => c.completedSeasons >= MIN_SEASONS)
          .sort((a, b) => avgPF(b) - avgPF(a) || byName(a, b))
          .slice(0, TOP_N)
          .map(c => ({
            key: avgPF(c).toFixed(2),
            row: {
              cells: [
                c.name,
                avgPF(c).toFixed(2),
                c.completedPointsFor.toFixed(2),
                c.completedSeasons.toString(),
              ],
            },
          })),
      ),
    },
    {
      title: 'Most Career Median Wins',
      headers: ['Player', 'Median Wins', 'Median Record', 'Seasons'],
      rows: withRanks(
        [...careers]
          .sort(
            (a, b) =>
              b.medianWins - a.medianWins ||
              a.medianLosses - b.medianLosses ||
              byName(a, b),
          )
          .slice(0, TOP_N)
          .map(c => ({
            key: c.medianWins.toString(),
            row: {
              cells: [
                c.name,
                c.medianWins.toString(),
                `${c.medianWins}-${c.medianLosses}-${c.medianTies}`,
                c.seasons.toString(),
              ],
            },
          })),
      ),
    },
    {
      title: 'Most Seasons Played',
      headers: ['Player', 'Seasons', 'Career Record'],
      rows: withRanks(
        [...careers]
          .sort(
            (a, b) => b.seasons - a.seasons || b.wins - a.wins || byName(a, b),
          )
          .slice(0, TOP_N)
          .map(c => ({
            key: c.seasons.toString(),
            row: {
              cells: [
                c.name,
                c.seasons.toString(),
                `${c.wins}-${c.losses}-${c.ties}`,
              ],
            },
          })),
      ),
    },
  ];
}

function buildSingleSeasonRecords(seasons: TeamSeason[]): RecordTable[] {
  const totalGames = (s: TeamSeason) =>
    s.team.wins + s.team.losses + s.team.ties;
  const winPct = (s: TeamSeason) =>
    totalGames(s) > 0 ? s.team.wins / totalGames(s) : 0;
  const differential = (s: TeamSeason) =>
    s.regularSeasonPointsFor - s.headToHeadPointsAgainst;
  const byTeam = (a: TeamSeason, b: TeamSeason) =>
    a.team.year - b.team.year || a.team.userName.localeCompare(b.team.userName);

  const makeRow = (s: TeamSeason, value: string) => ({
    cells: [s.team.userName, value, s.team.year.toString(), s.team.leagueName],
    leagueName: s.team.leagueName.toLowerCase(),
  });

  return [
    {
      title: 'Most Wins in a Season',
      headers: ['Player', 'Record', 'Year', 'League'],
      rows: withRanks(
        [...seasons]
          .sort(
            (a, b) =>
              b.team.wins - a.team.wins ||
              a.team.losses - b.team.losses ||
              b.regularSeasonPointsFor - a.regularSeasonPointsFor ||
              byTeam(a, b),
          )
          .slice(0, TOP_N)
          .map(s => ({
            key: `${s.team.wins}-${s.team.losses}-${s.team.ties}`,
            row: makeRow(s, `${s.team.wins}-${s.team.losses}-${s.team.ties}`),
          })),
      ),
    },
    {
      title: 'Best Win Percentage (completed seasons)',
      headers: ['Player', 'Win %', 'Year', 'League'],
      rows: withRanks(
        seasons
          .filter(s => s.isSeasonComplete && totalGames(s) > 0)
          .sort(
            (a, b) =>
              winPct(b) - winPct(a) ||
              totalGames(b) - totalGames(a) ||
              byTeam(a, b),
          )
          .slice(0, TOP_N)
          .map(s => ({
            key: (winPct(s) * 100).toFixed(1),
            row: makeRow(s, (winPct(s) * 100).toFixed(1) + '%'),
          })),
      ),
    },
    {
      title: 'Most Points For in a Season (regular season)',
      headers: ['Player', 'Points For', 'Year', 'League'],
      rows: withRanks(
        [...seasons]
          .sort(
            (a, b) =>
              b.regularSeasonPointsFor - a.regularSeasonPointsFor ||
              byTeam(a, b),
          )
          .slice(0, TOP_N)
          .map(s => ({
            key: s.regularSeasonPointsFor.toFixed(2),
            row: makeRow(s, s.regularSeasonPointsFor.toFixed(2)),
          })),
      ),
    },
    {
      title: 'Most Points Against in a Season (head-to-head)',
      headers: ['Player', 'Points Against', 'Year', 'League'],
      rows: withRanks(
        [...seasons]
          .sort(
            (a, b) =>
              b.headToHeadPointsAgainst - a.headToHeadPointsAgainst ||
              byTeam(a, b),
          )
          .slice(0, TOP_N)
          .map(s => ({
            key: s.headToHeadPointsAgainst.toFixed(2),
            row: makeRow(s, s.headToHeadPointsAgainst.toFixed(2)),
          })),
      ),
    },
    {
      title: 'Largest Points Differential (regular season, PF - PA)',
      headers: ['Player', 'Differential', 'Year', 'League'],
      rows: withRanks(
        [...seasons]
          .sort((a, b) => differential(b) - differential(a) || byTeam(a, b))
          .slice(0, TOP_N)
          .map(s => {
            const value =
              differential(s) > 0
                ? `+${differential(s).toFixed(2)}`
                : differential(s).toFixed(2);

            return { key: value, row: makeRow(s, value) };
          }),
      ),
    },
    {
      title: 'Most Median Wins in a Season',
      headers: ['Player', 'Median Record', 'Year', 'League'],
      rows: withRanks(
        [...seasons]
          .sort(
            (a, b) =>
              b.team.medianWins - a.team.medianWins ||
              a.team.medianLosses - b.team.medianLosses ||
              byTeam(a, b),
          )
          .slice(0, TOP_N)
          .map(s => ({
            key: `${s.team.medianWins}-${s.team.medianLosses}-${s.team.medianTies}`,
            row: makeRow(
              s,
              `${s.team.medianWins}-${s.team.medianLosses}-${s.team.medianTies}`,
            ),
          })),
      ),
    },
  ];
}

function buildSingleGameRecords(seasons: TeamSeason[]): RecordTable[] {
  type WeekScore = {
    userName: string;
    year: number;
    leagueName: string;
    week: number;
    pointsScored: number;
  };

  const weekScores: WeekScore[] = [];
  for (const season of seasons) {
    for (const [week, summary] of season.weeks) {
      weekScores.push({
        userName: season.team.userName,
        year: season.team.year,
        leagueName: season.team.leagueName,
        week,
        pointsScored: summary.pointsScored,
      });
    }
  }

  const byScore = (a: WeekScore, b: WeekScore) =>
    a.year - b.year || a.week - b.week || a.userName.localeCompare(b.userName);

  const makeEntry = (score: WeekScore) => ({
    key: score.pointsScored.toFixed(2),
    row: {
      cells: [
        score.userName,
        score.pointsScored.toFixed(2),
        `W${score.week}`,
        score.year.toString(),
        score.leagueName,
      ],
      leagueName: score.leagueName.toLowerCase(),
    },
  });

  return [
    {
      title: 'Highest Score in a Single Week',
      headers: ['Player', 'Points', 'Week', 'Year', 'League'],
      rows: withRanks(
        [...weekScores]
          .sort((a, b) => b.pointsScored - a.pointsScored || byScore(a, b))
          .slice(0, TOP_N)
          .map(makeEntry),
      ),
    },
    {
      title: 'Lowest Score in a Single Week',
      headers: ['Player', 'Points', 'Week', 'Year', 'League'],
      rows: withRanks(
        weekScores
          // A true 0.00 is a team that never set a lineup, not a low score.
          .filter(score => score.pointsScored > 0)
          .sort((a, b) => a.pointsScored - b.pointsScored || byScore(a, b))
          .slice(0, TOP_N)
          .map(makeEntry),
      ),
    },
  ];
}

function buildCupRecords(cupGames: RecordsCupGame[]): RecordTable[] {
  interface CupStats {
    name: string;
    championships: number;
    finalsAppearances: number;
    gameWins: number;
    gamesPlayed: number;
  }

  const cupStatsMap = new Map<string, CupStats>();

  const getOrCreate = (user: RecordsCupUser): CupStats => {
    let stats = cupStatsMap.get(user.userId);
    if (!stats) {
      stats = {
        name: user.userName,
        championships: 0,
        finalsAppearances: 0,
        gameWins: 0,
        gamesPlayed: 0,
      };
      cupStatsMap.set(user.userId, stats);
    }

    return stats;
  };

  for (const game of cupGames) {
    // A bye or a walkover advances a team without a game being played, so it is
    // neither a win nor an appearance.
    if (game.containsBye || !game.isContested) continue;

    if (game.topUser) getOrCreate(game.topUser).gamesPlayed++;
    if (game.bottomUser) getOrCreate(game.bottomUser).gamesPlayed++;
    if (game.winningUser) getOrCreate(game.winningUser).gameWins++;

    if (game.round === 'ROUND_OF_2') {
      if (game.topUser) getOrCreate(game.topUser).finalsAppearances++;
      if (game.bottomUser) getOrCreate(game.bottomUser).finalsAppearances++;
      if (game.winningUser) getOrCreate(game.winningUser).championships++;
    }
  }

  const cupStats = [...cupStatsMap.values()];
  const byName = (a: CupStats, b: CupStats) => a.name.localeCompare(b.name);
  const winPct = (c: CupStats) =>
    c.gamesPlayed > 0 ? c.gameWins / c.gamesPlayed : 0;

  return [
    {
      title: 'Most Cup Championships',
      headers: ['Player', 'Championships', 'Finals', 'Games Won'],
      rows: withRanks(
        cupStats
          .filter(c => c.championships > 0)
          .sort(
            (a, b) =>
              b.championships - a.championships ||
              b.finalsAppearances - a.finalsAppearances ||
              byName(a, b),
          )
          .slice(0, TOP_N)
          .map(c => ({
            key: c.championships.toString(),
            row: {
              cells: [
                c.name,
                c.championships.toString(),
                c.finalsAppearances.toString(),
                c.gameWins.toString(),
              ],
            },
          })),
      ),
    },
    {
      title: 'Most Cup Finals Appearances',
      headers: ['Player', 'Finals', 'Championships', 'Games Won'],
      rows: withRanks(
        cupStats
          .filter(c => c.finalsAppearances > 0)
          .sort(
            (a, b) =>
              b.finalsAppearances - a.finalsAppearances ||
              b.championships - a.championships ||
              byName(a, b),
          )
          .slice(0, TOP_N)
          .map(c => ({
            key: c.finalsAppearances.toString(),
            row: {
              cells: [
                c.name,
                c.finalsAppearances.toString(),
                c.championships.toString(),
                c.gameWins.toString(),
              ],
            },
          })),
      ),
    },
    {
      title: 'Most Cup Game Wins',
      headers: ['Player', 'Wins', 'Games Played', 'Win %'],
      rows: withRanks(
        cupStats
          .filter(c => c.gameWins > 0)
          .sort(
            (a, b) =>
              b.gameWins - a.gameWins ||
              a.gamesPlayed - b.gamesPlayed ||
              byName(a, b),
          )
          .slice(0, TOP_N)
          .map(c => ({
            key: c.gameWins.toString(),
            row: {
              cells: [
                c.name,
                c.gameWins.toString(),
                c.gamesPlayed.toString(),
                (winPct(c) * 100).toFixed(1) + '%',
              ],
            },
          })),
      ),
    },
  ];
}

function buildStreakRecords(seasons: TeamSeason[]): RecordTable[] {
  const winStreaks: StreakInfo[] = [];
  const lossStreaks: StreakInfo[] = [];
  const hundredPointStreaks: StreakInfo[] = [];

  for (const season of seasons) {
    const lastWeek = regularSeasonLastWeek(season.team.year);

    // Each week contributes its head-to-head result and, where the league plays
    // one, its median result - in the same order Sleeper records them. A week
    // without a usable result is a hole that breaks the streak.
    const results: StreakEntry<{ result: GameResult }>[] = [];
    const scores: StreakEntry<{ pointsScored: number }>[] = [];

    for (let week = 1; week <= lastWeek; week++) {
      const summary = season.weeks.get(week);

      if (!summary || summary.headToHead === null) {
        results.push(null);
      } else {
        results.push({ week, result: summary.headToHead });
        if (summary.median !== null) {
          results.push({ week, result: summary.median });
        }
      }

      scores.push(
        summary ? { week, pointsScored: summary.pointsScored } : null,
      );
    }

    const describe = (
      streak: { length: number; startWeek: number; endWeek: number } | null,
    ): StreakInfo | null =>
      streak && {
        userName: season.team.userName,
        year: season.team.year,
        leagueName: season.team.leagueName,
        ...streak,
      };

    const winStreak = describe(computeStreak(results, r => r.result === 'W'));
    if (winStreak) winStreaks.push(winStreak);

    const lossStreak = describe(computeStreak(results, r => r.result === 'L'));
    if (lossStreak) lossStreaks.push(lossStreak);

    const hundredPointStreak = describe(
      computeStreak(scores, s => s.pointsScored >= HUNDRED_POINT_THRESHOLD),
    );
    if (hundredPointStreak) hundredPointStreaks.push(hundredPointStreak);
  }

  const makeTable = (title: string, streaks: StreakInfo[]): RecordTable => ({
    title,
    headers: ['Player', 'Games', 'Span', 'League'],
    rows: withRanks(
      streaks
        .sort(
          (a, b) =>
            b.length - a.length ||
            a.year - b.year ||
            a.userName.localeCompare(b.userName),
        )
        .slice(0, TOP_N)
        .map(s => ({
          key: s.length.toString(),
          row: {
            cells: [
              s.userName,
              s.length.toString(),
              `${s.year} W${s.startWeek}${
                s.startWeek !== s.endWeek ? `-W${s.endWeek}` : ''
              }`,
              s.leagueName,
            ],
            leagueName: s.leagueName.toLowerCase(),
          },
        })),
    ),
  });

  return [
    makeTable('Longest Win Streak (H2H + median, single season)', winStreaks),
    makeTable(
      'Longest Losing Streak (H2H + median, single season)',
      lossStreaks,
    ),
    makeTable('Longest 100+ Point Streak (single season)', hundredPointStreaks),
  ];
}

/**
 * Pure record book computation, split out from the queries so the maths can be
 * exercised without a database.
 */
export function buildRecords({
  teams,
  games,
  cupGames,
  isWeekFinal,
}: RecordsInput): RecordCategories {
  const seasons = buildTeamSeasons(teams, games, isWeekFinal);

  return {
    careerRecords: buildCareerRecords(seasons),
    singleSeasonRecords: buildSingleSeasonRecords(seasons),
    singleGameRecords: buildSingleGameRecords(seasons),
    cupRecords: buildCupRecords(cupGames),
    streakRecords: buildStreakRecords(seasons),
  };
}

const cupTeamUserSelect = {
  userId: true,
  user: { select: { discordName: true } },
} as const;

export async function getRecords(): Promise<RecordCategories> {
  const [teamRows, gameRows, cupGameRows, unfinalizedWeeks] = await Promise.all(
    [
      prisma.team.findMany({
        where: { userId: { not: null } },
        select: {
          id: true,
          userId: true,
          leagueId: true,
          wins: true,
          losses: true,
          ties: true,
          medianWins: true,
          medianLosses: true,
          medianTies: true,
          user: { select: { discordName: true } },
          league: { select: { year: true, name: true } },
        },
      }),
      prisma.teamGame.findMany({
        where: {
          isRegularSeason: true,
          team: { userId: { not: null } },
        },
        select: {
          teamId: true,
          week: true,
          sleeperMatchupId: true,
          pointsScored: true,
        },
      }),
      prisma.cupGame.findMany({
        where: {
          winningTeamId: { not: null },
        },
        select: {
          round: true,
          containsBye: true,
          topTeamId: true,
          bottomTeamId: true,
          winningTeam: { select: { team: { select: cupTeamUserSelect } } },
          topTeam: { select: { team: { select: cupTeamUserSelect } } },
          bottomTeam: { select: { team: { select: cupTeamUserSelect } } },
        },
      }),
      getUnfinalizedWeeks(),
    ],
  );

  const teams: RecordsTeam[] = teamRows.map(team => ({
    id: team.id,
    userId: team.userId!,
    userName: team.user?.discordName || 'Unknown',
    leagueId: team.leagueId,
    leagueName: team.league.name,
    year: team.league.year,
    wins: team.wins,
    losses: team.losses,
    ties: team.ties,
    medianWins: team.medianWins,
    medianLosses: team.medianLosses,
    medianTies: team.medianTies,
  }));

  const toCupUser = (
    cupTeam: {
      team: { userId: string | null; user: { discordName: string } | null };
    } | null,
  ): RecordsCupUser | null =>
    cupTeam?.team.userId
      ? {
          userId: cupTeam.team.userId,
          userName: cupTeam.team.user?.discordName || 'Unknown',
        }
      : null;

  const cupGames: RecordsCupGame[] = cupGameRows.map(game => ({
    round: game.round,
    containsBye: game.containsBye,
    isContested: game.topTeamId !== null && game.bottomTeamId !== null,
    topUser: toCupUser(game.topTeam),
    bottomUser: toCupUser(game.bottomTeam),
    winningUser: toCupUser(game.winningTeam),
  }));

  return buildRecords({
    teams,
    games: gameRows,
    cupGames,
    // A year/week with no tracked NFL games is historical data, not a week in
    // progress - NFL games are only stored from 2022 onward.
    isWeekFinal: (year, week) => !unfinalizedWeeks.has(`${year}:${week}`),
  });
}
