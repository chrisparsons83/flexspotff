import { GUILLOTINE_FINAL_WEEK } from '~/libs/guillotine/chops';
import type {
  GridCell,
  ViewTeam,
  ViewTransaction,
  ViewWeekScore,
} from '~/libs/guillotine/views';
import {
  buildChopGrid,
  buildStandings,
  buildWaiverRuns,
} from '~/libs/guillotine/views';

/**
 * The Guillotine profile tab, from one member's teams. Pure, so the career
 * maths is testable without a database; the league pages' own builders do the
 * per-league work, so a number here always agrees with the league's page.
 */

export type GuillotineLeagueInput = {
  leagueId: string;
  leagueName: string;
  year: number;
  teamCount: number;
  isComplete: boolean;
  lastScoredWeek: number;
  /** The member's roster in this league. */
  rosterId: number;
  /**
   * FAAB they had left, by Sleeper's own balance - the figure the league page
   * shows. It does not always match the claims: commissioners zeroed chopped
   * rosters by hand in the manual years, and adjusted budgets here and there.
   */
  faabLeft: number;
  /** Every team and score in the league: escapes are measured against them. */
  teams: ViewTeam[];
  scores: ViewWeekScore[];
  transactions: ViewTransaction[];
  /** The member's own draft picks. */
  picks: { pickNo: number; round: number; sleeperId: string }[];
};

export type SurvivalWeek =
  | ({ week: number; state: 'survived' | 'chopped' } & GridCell)
  | { week: number; state: 'pending' | 'gone' };

export type GuillotineSeason = {
  leagueId: string;
  leagueName: string;
  year: number;
  teamCount: number;
  isComplete: boolean;
  place: number | null;
  alive: boolean;
  choppedWeek: number | null;
  weeksSurvived: number;
  /** Weeks they put up a score: the chop week counts, unlike `weeksSurvived`. */
  weeksPlayed: number;
  averagePoints: number | null;
  /**
   * Each week's finish as a percentile of the teams still alive: the share of
   * the field they outscored, 0 to 1. The field shrinks every week, so third
   * of 18 and third of 4 are very different weeks; a percentile is not.
   */
  weeklyPercentiles: number[];
  /** Weeks they were the top scorer. */
  topScoreWeeks: number;
  bestWeek: { week: number; points: number } | null;
  closestEscape: { week: number; margin: number } | null;
  claimsWon: number;
  bidsLost: number;
  faabSpent: number;
  faabLeft: number;
  biggestClaim: { sleeperId: string; bid: number; week: number } | null;
  /** Weeks 1-17, for the survival strip. */
  weeks: SurvivalWeek[];
  picks: (GuillotineLeagueInput['picks'][number] & {
    /**
     * How many teams the player was on over the season: every roster he was
     * on in a scored week, and the one that drafted him. Guillotine rosters
     * churn - a chopped team's players all go back to waivers.
     */
    teams: number;
  })[];
};

export type GuillotineClaim = {
  sleeperId: string;
  bid: number;
  week: number;
  year: number;
  leagueName: string;
};

export type GuillotineCareer = {
  seasons: number;
  titles: number;
  podiums: number;
  bestFinish: {
    place: number;
    teamCount: number;
    year: number;
    leagueName: string;
  } | null;
  /** Most weeks played in a season, a live one included. */
  longestRun: SeasonRun | null;
  /** Fewest weeks played in a season that is over for them. */
  shortestRun: SeasonRun | null;
  averagePoints: number | null;
  /** Every week's percentile finish, across all seasons. */
  weeklyPercentiles: number[];
  averagePercentile: number | null;
  topScoreWeeks: number;
  bestWeek: {
    points: number;
    week: number;
    year: number;
    leagueName: string;
  } | null;
  closestEscape: {
    margin: number;
    week: number;
    year: number;
    leagueName: string;
  } | null;
  claimsWon: number;
  bidsLost: number;
  /** Share of their bids that won, 0 to 1. */
  bidWinRate: number | null;
  averageWinningBid: number | null;
  faabSpent: number;
  /** Their largest single winning bid. */
  biggestBid: { bid: number; year: number; leagueName: string } | null;
};

export type SeasonRun = {
  weeks: number;
  year: number;
  leagueName: string;
  alive: boolean;
};

const round = (value: number) => Math.round(value * 100) / 100;

export function buildGuillotineSeason(
  input: GuillotineLeagueInput,
): GuillotineSeason {
  const standing = buildStandings({
    teams: input.teams,
    scores: input.scores,
    lastScoredWeek: input.lastScoredWeek,
  }).find(row => row.rosterId === input.rosterId);

  const grid = buildChopGrid({
    teams: input.teams,
    scores: input.scores,
    throughWeek: input.lastScoredWeek,
  });
  const cells = grid.get(input.rosterId) ?? new Map<number, GridCell>();

  // How many teams put up a score each week, which is the field they ranked in.
  const fieldSize = new Map<number, number>();
  for (const teamCells of grid.values()) {
    for (const week of teamCells.keys()) {
      fieldSize.set(week, (fieldSize.get(week) ?? 0) + 1);
    }
  }
  const weeklyPercentiles: number[] = [];
  let topScoreWeeks = 0;
  for (const [week, cell] of cells) {
    const field = fieldSize.get(week) ?? 1;
    weeklyPercentiles.push(field > 1 ? (field - cell.rank) / (field - 1) : 1);
    if (cell.rank === 1) topScoreWeeks++;
  }

  const choppedWeek = standing?.choppedWeek ?? null;
  const weeks: SurvivalWeek[] = Array.from(
    { length: GUILLOTINE_FINAL_WEEK },
    (_, i) => {
      const week = i + 1;
      const cell = cells.get(week);
      if (cell) {
        return {
          week,
          state: cell.chopped ? ('chopped' as const) : ('survived' as const),
          ...cell,
        };
      }
      return {
        week,
        state:
          choppedWeek !== null && week > choppedWeek
            ? ('gone' as const)
            : ('pending' as const),
      };
    },
  );

  let claimsWon = 0;
  let bidsLost = 0;
  let faabSpent = 0;
  let biggestClaim: GuillotineSeason['biggestClaim'] = null;
  for (const run of buildWaiverRuns({
    transactions: input.transactions,
    teams: input.teams,
    scores: input.scores,
  })) {
    for (const claim of run.claims) {
      if (claim.winner?.rosterId === input.rosterId) {
        claimsWon++;
        faabSpent += claim.winner.bid;
        if (!biggestClaim || claim.winner.bid > biggestClaim.bid) {
          biggestClaim = {
            sleeperId: claim.sleeperId,
            bid: claim.winner.bid,
            week: run.week,
          };
        }
      }
      bidsLost += claim.losingBids.filter(
        bid => bid.rosterId === input.rosterId,
      ).length;
    }
  }

  return {
    leagueId: input.leagueId,
    leagueName: input.leagueName,
    year: input.year,
    teamCount: input.teamCount,
    isComplete: input.isComplete,
    place: standing?.place ?? null,
    alive: standing?.alive ?? false,
    choppedWeek,
    weeksSurvived: standing?.weeksSurvived ?? 0,
    weeksPlayed: cells.size,
    averagePoints: standing?.averagePoints ?? null,
    weeklyPercentiles,
    topScoreWeeks,
    bestWeek: standing?.bestWeek ?? null,
    closestEscape: standing?.closestEscape ?? null,
    claimsWon,
    bidsLost,
    faabSpent,
    faabLeft: input.faabLeft,
    biggestClaim,
    weeks,
    picks: [...input.picks]
      .sort((a, b) => a.pickNo - b.pickNo)
      .map(pick => {
        const teams = new Set([input.rosterId]);
        for (const score of input.scores) {
          if (score.players.includes(pick.sleeperId)) teams.add(score.rosterId);
        }
        return { ...pick, teams: teams.size };
      }),
  };
}

export function buildGuillotineCareer(
  seasons: GuillotineSeason[],
  scores: { points: number; week: number; year: number; leagueName: string }[],
): GuillotineCareer {
  const placed = seasons.filter(
    (s): s is GuillotineSeason & { place: number } => s.place !== null,
  );
  const best = [...placed].sort(
    (a, b) => a.place - b.place || b.year - a.year,
  )[0];

  const runs = seasons
    .filter(s => s.weeksPlayed > 0)
    .map(s => ({
      weeks: s.weeksPlayed,
      year: s.year,
      leagueName: s.leagueName,
      alive: s.alive,
    }));
  const longestRun = [...runs].sort(
    (a, b) => b.weeks - a.weeks || b.year - a.year,
  )[0];
  // A live season has not reached its length yet, so it cannot be the shortest.
  const shortestRun = runs
    .filter(run => !run.alive)
    .sort((a, b) => a.weeks - b.weeks || b.year - a.year)[0];
  const escapes = seasons
    .filter(s => s.closestEscape)
    .map(s => ({ ...s.closestEscape!, year: s.year, leagueName: s.leagueName }))
    .sort((a, b) => a.margin - b.margin);
  const bestWeek = [...scores].sort((a, b) => b.points - a.points)[0];

  const claimsWon = seasons.reduce((sum, s) => sum + s.claimsWon, 0);
  const bidsLost = seasons.reduce((sum, s) => sum + s.bidsLost, 0);
  const weeklyPercentiles = seasons.flatMap(s => s.weeklyPercentiles);
  const biggest = seasons
    .filter(s => s.biggestClaim)
    .sort(
      (a, b) => b.biggestClaim!.bid - a.biggestClaim!.bid || b.year - a.year,
    )[0];

  return {
    seasons: seasons.length,
    titles: placed.filter(s => s.place === 1).length,
    podiums: placed.filter(s => s.place <= 3).length,
    bestFinish: best
      ? {
          place: best.place,
          teamCount: best.teamCount,
          year: best.year,
          leagueName: best.leagueName,
        }
      : null,
    longestRun: longestRun ?? null,
    shortestRun: shortestRun ?? null,
    averagePoints: scores.length
      ? round(scores.reduce((sum, s) => sum + s.points, 0) / scores.length)
      : null,
    weeklyPercentiles,
    averagePercentile: weeklyPercentiles.length
      ? weeklyPercentiles.reduce((sum, p) => sum + p, 0) /
        weeklyPercentiles.length
      : null,
    topScoreWeeks: seasons.reduce((sum, s) => sum + s.topScoreWeeks, 0),
    bestWeek: bestWeek ?? null,
    closestEscape: escapes[0] ?? null,
    claimsWon,
    bidsLost,
    bidWinRate:
      claimsWon + bidsLost > 0 ? claimsWon / (claimsWon + bidsLost) : null,
    averageWinningBid: claimsWon
      ? round(seasons.reduce((sum, s) => sum + s.faabSpent, 0) / claimsWon)
      : null,
    faabSpent: seasons.reduce((sum, s) => sum + s.faabSpent, 0),
    biggestBid: biggest
      ? {
          bid: biggest.biggestClaim!.bid,
          year: biggest.year,
          leagueName: biggest.leagueName,
        }
      : null,
  };
}

/**
 * Their winning bids across every season, biggest first. All of them, so the
 * page can narrow to a season and still show that season's top few.
 */
export function winningClaims(
  inputs: GuillotineLeagueInput[],
): GuillotineClaim[] {
  return inputs
    .flatMap(input =>
      buildWaiverRuns({
        transactions: input.transactions,
        teams: input.teams,
        scores: input.scores,
      }).flatMap(run =>
        run.claims
          .filter(claim => claim.winner?.rosterId === input.rosterId)
          .map(claim => ({
            sleeperId: claim.sleeperId,
            bid: claim.winner!.bid,
            week: run.week,
            year: input.year,
            leagueName: input.leagueName,
          })),
      ),
    )
    .sort((a, b) => b.bid - a.bid || b.year - a.year);
}
