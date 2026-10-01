import {
  POSITION_GROUPS,
  averagePositionCounts,
  buildStandings,
  emptyPositionCounts,
  positionCounts,
  roundPoints,
} from '~/libs/best-ball/views';
import type { PositionCounts } from '~/libs/best-ball/views';

/**
 * The Best Ball profile tab, from one member's teams. Pure, so the career
 * maths is testable without a database; standings come from the same builder
 * as the league page, so a place here always agrees with it.
 */

export type BestBallPickInput = {
  pickNo: number;
  round: number;
  rosterId: number;
  sleeperId: string;
  position: string;
  playerName: string;
  nflTeam: string | null;
};

export type BestBallLeagueInput = {
  year: number;
  leagueName: string;
  isComplete: boolean;
  /** The member's roster in this league. */
  rosterId: number;
  teams: {
    id: string;
    rosterId: number;
    pointsFor: number;
    finish: number | null;
    draftSlot: number | null;
    weekScores: { week: number; points: number }[];
  }[];
  /** Every pick in the draft: the league average is measured against them. */
  picks: BestBallPickInput[];
};

export type BestBallSeason = {
  year: number;
  leagueName: string;
  isComplete: boolean;
  teamCount: number;
  /** The settled finish, or the live rank while the season runs. */
  place: number;
  pointsFor: number;
  /** Points behind first; 0 for the leader. */
  gap: number;
  draftSlot: number | null;
  bestWeek: { week: number; points: number } | null;
  topScores: number;
  counts: PositionCounts;
  leagueAverage: PositionCounts;
  /** How far this draft strayed from the league's average mix. */
  oddity: number;
  picks: BestBallPickInput[];
};

export type BestBallCareer = {
  seasons: number;
  titles: number;
  podiums: number;
  bestFinish: { place: number; year: number } | null;
  /** Across finished seasons only. */
  averageFinish: number | null;
  totalPoints: number;
  averagePointsPerWeek: number | null;
  bestWeek: { points: number; week: number; year: number } | null;
  /** Every pick the CPU ever made for them, by position. */
  positions: PositionCounts;
  /** The season their draft was furthest from the league's average mix. */
  oddestDraft: { year: number; counts: PositionCounts; oddity: number } | null;
};

export function buildBestBallSeason(
  input: BestBallLeagueInput,
): BestBallSeason {
  const standings = buildStandings(input.teams);
  const mine = standings.find(row => row.rosterId === input.rosterId);

  const countsByRoster = new Map<number, PositionCounts>(
    input.teams.map(team => [
      team.rosterId,
      positionCounts(input.picks.filter(p => p.rosterId === team.rosterId)),
    ]),
  );
  const counts = countsByRoster.get(input.rosterId) ?? emptyPositionCounts();
  const leagueAverage =
    averagePositionCounts([...countsByRoster.values()]) ??
    emptyPositionCounts();
  const oddity =
    Math.round(
      POSITION_GROUPS.reduce(
        (sum, group) => sum + Math.abs(counts[group] - leagueAverage[group]),
        0,
      ) * 10,
    ) / 10;

  return {
    year: input.year,
    leagueName: input.leagueName,
    isComplete: input.isComplete,
    teamCount: input.teams.length,
    place: mine?.rank ?? input.teams.length,
    pointsFor: mine?.pointsFor ?? 0,
    gap: mine?.gap ?? 0,
    draftSlot: mine?.draftSlot ?? null,
    bestWeek: mine?.bestWeek ?? null,
    topScores: mine?.topScores ?? 0,
    counts,
    leagueAverage,
    oddity,
    picks: input.picks
      .filter(p => p.rosterId === input.rosterId)
      .sort((a, b) => a.pickNo - b.pickNo),
  };
}

export function buildBestBallCareer(
  seasons: BestBallSeason[],
  weeksPlayed: number,
): BestBallCareer {
  const finished = seasons.filter(s => s.isComplete);
  const totalPoints = roundPoints(
    seasons.reduce((sum, s) => sum + s.pointsFor, 0),
  );

  let bestFinish: BestBallCareer['bestFinish'] = null;
  for (const season of finished) {
    if (!bestFinish || season.place < bestFinish.place) {
      bestFinish = { place: season.place, year: season.year };
    }
  }

  let bestWeek: BestBallCareer['bestWeek'] = null;
  for (const season of seasons) {
    if (
      season.bestWeek &&
      (!bestWeek || season.bestWeek.points > bestWeek.points)
    ) {
      bestWeek = { ...season.bestWeek, year: season.year };
    }
  }

  const positions = emptyPositionCounts();
  for (const season of seasons) {
    for (const group of POSITION_GROUPS) {
      positions[group] += season.counts[group];
    }
  }

  let oddestDraft: BestBallCareer['oddestDraft'] = null;
  for (const season of seasons) {
    if (season.picks.length === 0) continue;
    if (!oddestDraft || season.oddity > oddestDraft.oddity) {
      oddestDraft = {
        year: season.year,
        counts: season.counts,
        oddity: season.oddity,
      };
    }
  }

  return {
    seasons: seasons.length,
    titles: finished.filter(s => s.place === 1).length,
    podiums: finished.filter(s => s.place <= 3).length,
    bestFinish,
    averageFinish:
      finished.length > 0
        ? Math.round(
            (finished.reduce((sum, s) => sum + s.place, 0) / finished.length) *
              10,
          ) / 10
        : null,
    totalPoints,
    averagePointsPerWeek:
      weeksPlayed > 0 ? roundPoints(totalPoints / weeksPlayed) : null,
    bestWeek,
    positions,
    oddestDraft,
  };
}
