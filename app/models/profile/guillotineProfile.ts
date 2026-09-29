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
  averagePoints: number | null;
  bestWeek: { week: number; points: number } | null;
  closestEscape: { week: number; margin: number } | null;
  claimsWon: number;
  bidsLost: number;
  faabSpent: number;
  biggestClaim: { sleeperId: string; bid: number; week: number } | null;
  /** Weeks 1-17, for the survival strip. */
  weeks: SurvivalWeek[];
  picks: GuillotineLeagueInput['picks'];
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
  /** Across seasons that are over for them: chopped, or finished. */
  averageWeeksSurvived: number | null;
  weekOneChops: number;
  averagePoints: number | null;
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
  faabSpent: number;
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

  const cells =
    buildChopGrid({
      teams: input.teams,
      scores: input.scores,
      throughWeek: input.lastScoredWeek,
    }).get(input.rosterId) ?? new Map<number, GridCell>();

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
    averagePoints: standing?.averagePoints ?? null,
    bestWeek: standing?.bestWeek ?? null,
    closestEscape: standing?.closestEscape ?? null,
    claimsWon,
    bidsLost,
    faabSpent,
    biggestClaim,
    weeks,
    picks: [...input.picks].sort((a, b) => a.pickNo - b.pickNo),
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

  // A live season still in progress would drag the average down.
  const over = seasons.filter(s => !s.alive);
  const escapes = seasons
    .filter(s => s.closestEscape)
    .map(s => ({ ...s.closestEscape!, year: s.year, leagueName: s.leagueName }))
    .sort((a, b) => a.margin - b.margin);
  const bestWeek = [...scores].sort((a, b) => b.points - a.points)[0];

  const claimsWon = seasons.reduce((sum, s) => sum + s.claimsWon, 0);
  const bidsLost = seasons.reduce((sum, s) => sum + s.bidsLost, 0);

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
    averageWeeksSurvived: over.length
      ? round(over.reduce((sum, s) => sum + s.weeksSurvived, 0) / over.length)
      : null,
    weekOneChops: seasons.filter(s => s.choppedWeek === 1).length,
    averagePoints: scores.length
      ? round(scores.reduce((sum, s) => sum + s.points, 0) / scores.length)
      : null,
    bestWeek: bestWeek ?? null,
    closestEscape: escapes[0] ?? null,
    claimsWon,
    bidsLost,
    bidWinRate:
      claimsWon + bidsLost > 0 ? claimsWon / (claimsWon + bidsLost) : null,
    faabSpent: seasons.reduce((sum, s) => sum + s.faabSpent, 0),
  };
}

/** Their biggest winning bids, across every season. */
export function topClaims(
  inputs: GuillotineLeagueInput[],
  limit = 5,
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
    .sort((a, b) => b.bid - a.bid || b.year - a.year)
    .slice(0, limit);
}
