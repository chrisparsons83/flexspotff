/**
 * The D12 tab, worked out from rows the server has already loaded - kept apart
 * from `d12.server.ts` so the rules can be tested without a database.
 *
 * D12 has two kinds of week, and the tab shows both. A *combined* week is a
 * member's total across every team they run, which is what the leaderboard
 * adds up. A *team* week is one of those teams on its own.
 */

/** One of a member's weekly scores, in one league. */
export type D12ScoreRow = {
  year: number;
  week: number;
  points: number | null;
  leagueId: string;
  leagueName: string;
  starters: string[];
  startingPlayerPoints: number[];
};

export type D12Finish = { rank: number; fieldSize: number };

export type WeekMark = { points: number; year: number; week: number };
export type TeamWeekMark = WeekMark & { leagueName: string };
export type TeamSeasonMark = {
  points: number;
  year: number;
  leagueName: string;
};

export type D12Season = {
  year: number;
  inProgress: boolean;
  /** Every point scored, the live week included, so it matches the leaderboard. */
  total: number;
  finish: D12Finish | null;
  weeksCounted: number;
  averageWeek: number | null;
  bestWeek: WeekMark | null;
  worstWeek: WeekMark | null;
  teamWeeksCounted: number;
  averageTeamWeek: number | null;
  bestTeamWeek: TeamWeekMark | null;
  worstTeamWeek: TeamWeekMark | null;
  teams: number;
  averageTeam: number | null;
  bestTeam: TeamSeasonMark | null;
  worstTeam: TeamSeasonMark | null;
};

/** "The D12 v7" -> "v7". Anything not following the pattern is left alone. */
export function shortD12LeagueName(name: string): string {
  return name.replace(/^the d12\s+/i, '');
}

const average = (values: number[]) =>
  values.length > 0
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : null;

/**
 * Highest and lowest by `points`. The first one seen wins a tie, so callers
 * feed marks oldest first and the earlier week keeps the record.
 */
function extremes<T extends { points: number }>(marks: (T | null)[]) {
  let best: T | null = null;
  let worst: T | null = null;
  for (const mark of marks) {
    if (!mark) continue;
    if (!best || mark.points > best.points) best = mark;
    if (!worst || mark.points < worst.points) worst = mark;
  }
  return { best, worst };
}

/**
 * One entry per season the member played, newest first.
 *
 * A season still running has a half-played week in it, and that week would
 * walk away with "worst week" every Sunday morning. So its weeks only count
 * once a later week has scores - `newestWeekInProgress` is that later week.
 * The total still includes it, so the number agrees with the leaderboard.
 */
export function buildD12Seasons({
  rows,
  finishes,
  inProgressYear,
  newestWeekInProgress,
}: {
  rows: D12ScoreRow[];
  finishes: Map<number, D12Finish>;
  inProgressYear: number | null;
  newestWeekInProgress: number | null;
}): D12Season[] {
  const byYear = new Map<number, D12ScoreRow[]>();
  for (const row of rows) {
    const existing = byYear.get(row.year);
    if (existing) existing.push(row);
    else byYear.set(row.year, [row]);
  }

  return Array.from(byYear.entries())
    .map(([year, yearRows]) => {
      const inProgress = year === inProgressYear;
      const sorted = [...yearRows].sort(
        (a, b) => a.week - b.week || a.leagueName.localeCompare(b.leagueName),
      );
      const counted = sorted.filter(
        row =>
          row.points !== null &&
          (!inProgress ||
            (newestWeekInProgress !== null && row.week < newestWeekInProgress)),
      );

      const combined = new Map<number, number>();
      for (const row of counted) {
        combined.set(row.week, (combined.get(row.week) ?? 0) + row.points!);
      }
      const weekMarks = Array.from(combined.entries())
        .sort(([a], [b]) => a - b)
        .map(([week, points]) => ({ points, year, week }));

      const teamWeekMarks = counted.map(row => ({
        points: row.points!,
        year,
        week: row.week,
        leagueName: row.leagueName,
      }));

      const teamTotals = new Map<string, TeamSeasonMark>();
      for (const row of sorted) {
        const existing = teamTotals.get(row.leagueId) ?? {
          points: 0,
          year,
          leagueName: row.leagueName,
        };
        existing.points += row.points ?? 0;
        teamTotals.set(row.leagueId, existing);
      }
      const teamMarks = Array.from(teamTotals.values()).sort((a, b) =>
        a.leagueName.localeCompare(b.leagueName, undefined, { numeric: true }),
      );

      const weeks = extremes(weekMarks);
      const teamWeeks = extremes(teamWeekMarks);
      const teams = extremes(teamMarks);

      return {
        year,
        inProgress,
        total: sorted.reduce((sum, row) => sum + (row.points ?? 0), 0),
        finish: finishes.get(year) ?? null,
        weeksCounted: weekMarks.length,
        averageWeek: average(weekMarks.map(mark => mark.points)),
        bestWeek: weeks.best,
        worstWeek: weeks.worst,
        teamWeeksCounted: teamWeekMarks.length,
        averageTeamWeek: average(teamWeekMarks.map(mark => mark.points)),
        bestTeamWeek: teamWeeks.best,
        worstTeamWeek: teamWeeks.worst,
        teams: teamMarks.length,
        averageTeam: average(teamMarks.map(mark => mark.points)),
        bestTeam: teams.best,
        worstTeam: teams.worst,
      };
    })
    .sort((a, b) => b.year - a.year);
}

export type D12Career = {
  seasonsPlayed: number;
  averageWeek: number | null;
  bestWeek: WeekMark | null;
  worstWeek: WeekMark | null;
  averageTeamWeek: number | null;
  bestTeamWeek: TeamWeekMark | null;
  worstTeamWeek: TeamWeekMark | null;
  /** Finished seasons only - a team's total in October says little. */
  averageTeam: number | null;
  bestTeam: TeamSeasonMark | null;
  worstTeam: TeamSeasonMark | null;
  completedSeasons: number;
  bestFinish: (D12Finish & { year: number }) | null;
  titles: number;
  topThrees: number;
  averageFinish: number | null;
  /** Where they sit in the season still being played, if they are in it. */
  current: (D12Finish & { year: number }) | null;
};

/**
 * Career numbers from the season list. Weeks from the running season count,
 * since `buildD12Seasons` already dropped the live one. Team seasons and
 * finishes only count once the season is over, the same rule the D12 Champion
 * badge follows.
 */
export function buildD12Career(seasons: D12Season[]): D12Career {
  const oldestFirst = [...seasons].sort((a, b) => a.year - b.year);
  const completed = oldestFirst.filter(season => !season.inProgress);

  const weightedAverage = (
    pick: (season: D12Season) => [number | null, number],
  ) => {
    let sum = 0;
    let count = 0;
    for (const season of oldestFirst) {
      const [value, weight] = pick(season);
      if (value === null || weight === 0) continue;
      sum += value * weight;
      count += weight;
    }
    return count > 0 ? sum / count : null;
  };

  const weeks = extremes(
    oldestFirst.flatMap(season => [season.bestWeek, season.worstWeek]),
  );
  const teamWeeks = extremes(
    oldestFirst.flatMap(season => [season.bestTeamWeek, season.worstTeamWeek]),
  );
  const teams = extremes(
    completed.flatMap(season => [season.bestTeam, season.worstTeam]),
  );

  let teamSum = 0;
  let teamCount = 0;
  for (const season of completed) {
    if (season.averageTeam === null) continue;
    teamSum += season.averageTeam * season.teams;
    teamCount += season.teams;
  }

  const finishes = completed.flatMap(season =>
    season.finish ? [{ ...season.finish, year: season.year }] : [],
  );
  let bestFinish: D12Career['bestFinish'] = null;
  for (const finish of finishes) {
    // Latest wins a tie, so a repeat champion is shown their newest title.
    if (!bestFinish || finish.rank <= bestFinish.rank) bestFinish = finish;
  }

  const running = seasons.find(season => season.inProgress);

  return {
    seasonsPlayed: seasons.length,
    averageWeek: weightedAverage(s => [s.averageWeek, s.weeksCounted]),
    bestWeek: weeks.best,
    worstWeek: weeks.worst,
    averageTeamWeek: weightedAverage(s => [
      s.averageTeamWeek,
      s.teamWeeksCounted,
    ]),
    bestTeamWeek: teamWeeks.best,
    worstTeamWeek: teamWeeks.worst,
    averageTeam: teamCount > 0 ? teamSum / teamCount : null,
    bestTeam: teams.best,
    worstTeam: teams.worst,
    completedSeasons: completed.length,
    bestFinish,
    titles: finishes.filter(finish => finish.rank === 1).length,
    topThrees: finishes.filter(finish => finish.rank <= 3).length,
    averageFinish: average(finishes.map(finish => finish.rank)),
    current: running?.finish ? { ...running.finish, year: running.year } : null,
  };
}

/**
 * How brightly a board cell is lit. 1-5 rank the players who scored against
 * each other, `bust` is a pick that has not scored a starting point despite
 * weeks being played, and `none` means there is nothing to judge yet.
 */
export type D12Heat = 1 | 2 | 3 | 4 | 5 | 'bust' | 'none';

export type D12BoardPick = {
  round: number;
  pickNo: number;
  /** "3.07" - round, then the pick within it. */
  pickLabel: string;
  sleeperId: string;
  firstName: string | null;
  lastName: string | null;
  position: string | null;
  nflTeam: string | null;
  /** Points as a best-ball starter for this team, or null before any lineup. */
  points: number | null;
  heat: D12Heat;
};

export type D12BoardColumn = {
  slot: number;
  league: { id: string; name: string; shortName: string } | null;
  teamPoints: number | null;
  picks: D12BoardPick[];
};

export type D12Board = {
  year: number;
  rounds: number;
  columns: D12BoardColumn[];
};

export type D12BoardPlayer = {
  firstName: string;
  lastName: string;
  position: string | null;
  nflTeam: string | null;
};

/**
 * Every D12 league is twelve teams. Taken as given rather than worked out from
 * the picks: a member's pick count is not a reliable round count, and a size
 * guessed from it put picks in the wrong rounds.
 */
export const D12_TEAMS = 12;

/** Which round a pick falls in, and where in that round. */
export function pickPosition(pickNo: number, teams: number) {
  const round = Math.ceil(pickNo / teams);
  return { round, inRound: pickNo - (round - 1) * teams };
}

/**
 * The draft slot a pick implies, assuming a snake draft: odd rounds run 1 to
 * `teams`, even rounds back again.
 */
export function slotForPick(pickNo: number, teams: number) {
  const { round, inRound } = pickPosition(pickNo, teams);
  return round % 2 === 1 ? inRound : teams + 1 - inRound;
}

/**
 * Tiers the scorers by percentile rank against each other, so the board reads
 * the same in week 3 as in week 17 - no fixed threshold would.
 */
function heatFor(points: number | null, scorers: number[]): D12Heat {
  if (points === null) return 'none';
  if (points <= 0) return 'bust';
  if (scorers.length <= 1) return 3;
  // First index, so tied players share the lower tier.
  const index = scorers.indexOf(points);
  const percentile = index / (scorers.length - 1);
  return Math.min(5, 1 + Math.floor(percentile * 5)) as 1 | 2 | 3 | 4 | 5;
}

/**
 * One member's drafts for a season, laid side by side.
 *
 * Every D12 league has a team drafting from each slot, and a member plays in
 * each league from a different one, so their drafts fill a whole board. A slot
 * with no league behind it - they are not in that league, or its picks have
 * not synced - comes back as an empty column rather than being skipped, so the
 * board keeps its shape.
 *
 * Two leagues landing on the same slot means the data is off somewhere. The
 * second is not dropped - its picks would vanish from the board and from the
 * exposure counts - but added as an extra column after slot twelve.
 */
export function buildD12DraftBoard({
  year,
  leagues,
  picks,
  rows,
  players,
}: {
  year: number;
  leagues: { id: string; name: string }[];
  picks: { leagueId: string; pickNo: number; sleeperId: string }[];
  /** The member's scores for this season, for points and lineups. */
  rows: D12ScoreRow[];
  players: Map<string, D12BoardPlayer>;
}): D12Board {
  const bySlot = new Map<number, D12BoardColumn>();
  const extras: D12BoardColumn[] = [];

  for (const league of leagues) {
    const leaguePicks = picks
      .filter(pick => pick.leagueId === league.id)
      .sort((a, b) => a.pickNo - b.pickNo);
    if (leaguePicks.length === 0) continue;

    const slot = slotForPick(leaguePicks[0].pickNo, D12_TEAMS);

    const leagueRows = rows.filter(row => row.leagueId === league.id);
    const hasLineups = leagueRows.some(row => row.starters.length > 0);
    const contributed = new Map<string, number>();
    for (const row of leagueRows) {
      row.starters.forEach((sleeperId, index) => {
        contributed.set(
          sleeperId,
          (contributed.get(sleeperId) ?? 0) +
            (row.startingPlayerPoints[index] ?? 0),
        );
      });
    }

    const column: D12BoardColumn = {
      slot,
      league: {
        id: league.id,
        name: league.name,
        shortName: shortD12LeagueName(league.name),
      },
      teamPoints:
        leagueRows.length > 0
          ? leagueRows.reduce((sum, row) => sum + (row.points ?? 0), 0)
          : null,
      picks: leaguePicks.map(pick => {
        const { round, inRound } = pickPosition(pick.pickNo, D12_TEAMS);
        const player = players.get(pick.sleeperId);
        return {
          round,
          pickNo: pick.pickNo,
          pickLabel: `${round}.${inRound.toString().padStart(2, '0')}`,
          sleeperId: pick.sleeperId,
          firstName: player?.firstName ?? null,
          lastName: player?.lastName ?? null,
          position: player?.position ?? null,
          nflTeam: player?.nflTeam ?? null,
          points: hasLineups ? contributed.get(pick.sleeperId) ?? 0 : null,
          heat: 'none',
        };
      }),
    };
    if (bySlot.has(slot)) extras.push(column);
    else bySlot.set(slot, column);
  }

  const columns: D12BoardColumn[] = [];
  for (let slot = 1; slot <= D12_TEAMS; slot++) {
    columns.push(
      bySlot.get(slot) ?? { slot, league: null, teamPoints: null, picks: [] },
    );
  }
  columns.push(...extras);

  const allPicks = columns.flatMap(column => column.picks);
  const scorers = allPicks
    .map(pick => pick.points)
    .filter((points): points is number => points !== null && points > 0)
    .sort((a, b) => a - b);
  for (const pick of allPicks) pick.heat = heatFor(pick.points, scorers);

  return {
    year,
    rounds: Math.max(0, ...allPicks.map(pick => pick.round)),
    columns,
  };
}

export type D12ExposureRow = {
  sleeperId: string;
  firstName: string | null;
  lastName: string | null;
  position: string | null;
  nflTeam: string | null;
  /** How many of their teams drafted him. */
  leagues: number;
  averagePick: number;
  earliestPick: number;
  latestPick: number;
  /** Starter points summed across those teams, or null before any lineup. */
  points: number | null;
};

/**
 * Who a member kept drafting in a season: one row per player, read off the
 * combined board. Most-owned first, then earliest drafted.
 */
export function buildD12Exposure(board: D12Board): {
  teams: number;
  players: D12ExposureRow[];
} {
  const byPlayer = new Map<string, D12BoardPick[]>();
  for (const column of board.columns) {
    for (const pick of column.picks) {
      const existing = byPlayer.get(pick.sleeperId);
      if (existing) existing.push(pick);
      else byPlayer.set(pick.sleeperId, [pick]);
    }
  }

  const players = Array.from(byPlayer.entries()).map(([sleeperId, picks]) => {
    const pickNos = picks.map(pick => pick.pickNo);
    const scored = picks.filter(pick => pick.points !== null);
    return {
      sleeperId,
      firstName: picks[0].firstName,
      lastName: picks[0].lastName,
      position: picks[0].position,
      nflTeam: picks[0].nflTeam,
      leagues: picks.length,
      averagePick: average(pickNos)!,
      earliestPick: Math.min(...pickNos),
      latestPick: Math.max(...pickNos),
      points:
        scored.length > 0
          ? scored.reduce((sum, pick) => sum + pick.points!, 0)
          : null,
    };
  });

  players.sort(
    (a, b) => b.leagues - a.leagues || a.averagePick - b.averagePick,
  );

  return {
    teams: board.columns.filter(column => column.league).length,
    players,
  };
}
