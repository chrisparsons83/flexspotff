import { assignCompetitionRanks } from '~/utils/rank';

/**
 * Best ball is ranked on points for over the regular season through week 17.
 * Sleeper keeps scoring week 18, and its season total includes it, so the
 * total is summed here from the weeks we store instead.
 */
export const BEST_BALL_FINAL_WEEK = 17;

/** The positions the breakdown names; anything else the CPU took is "Other". */
export const POSITION_GROUPS = ['QB', 'RB', 'WR', 'TE', 'Other'] as const;
export type PositionGroup = (typeof POSITION_GROUPS)[number];
export type PositionCounts = Record<PositionGroup, number>;

export const positionGroup = (position: string | null | undefined) =>
  (POSITION_GROUPS as readonly string[]).includes(position ?? '') &&
  position !== 'Other'
    ? (position as PositionGroup)
    : 'Other';

export const emptyPositionCounts = (): PositionCounts => ({
  QB: 0,
  RB: 0,
  WR: 0,
  TE: 0,
  Other: 0,
});

export function positionCounts(
  picks: { position: string | null | undefined }[],
): PositionCounts {
  const counts = emptyPositionCounts();
  for (const pick of picks) counts[positionGroup(pick.position)] += 1;
  return counts;
}

/**
 * The weeks worth asking Sleeper for: everything scored, plus the week in
 * progress while the season is live. Nothing before the draft, and never past
 * week 17.
 */
export function weeksToSync({
  status,
  lastScoredWeek,
}: {
  status: string | null | undefined;
  lastScoredWeek: number;
}): number {
  if (status === 'pre_draft' || status === 'drafting') return 0;
  if (status === 'complete') return BEST_BALL_FINAL_WEEK;
  return Math.min(Math.max(lastScoredWeek + 1, 1), BEST_BALL_FINAL_WEEK);
}

/**
 * Whether week 17 is final, which is when the finishes are settled and the
 * champion gets the ribbon. Waiting for Sleeper to move past week 17 rather
 * than for week 17 itself to be scored leaves room for stat corrections.
 */
export function isSeasonComplete({
  status,
  lastScoredLeg,
}: {
  status: string | null | undefined;
  lastScoredLeg: number;
}) {
  return status === 'complete' || lastScoredLeg > BEST_BALL_FINAL_WEEK;
}

/**
 * Who a roster belongs to: Sleeper's owner, or for a roster whose manager has
 * since left, whoever was on the clock for its picks.
 */
export function resolveRosterOwners(
  rosters: { roster_id: number; owner_id: string | null }[],
  picks: { roster_id: number; picked_by?: string | null }[],
): Map<number, string | null> {
  const drafter = new Map<number, string>();
  for (const pick of picks) {
    if (pick.picked_by && !drafter.has(pick.roster_id)) {
      drafter.set(pick.roster_id, pick.picked_by);
    }
  }
  return new Map(
    rosters.map(roster => [
      roster.roster_id,
      roster.owner_id ?? drafter.get(roster.roster_id) ?? null,
    ]),
  );
}

/** Rounds to Sleeper's two decimals, which summing floats does not keep. */
export const roundPoints = (points: number) => Math.round(points * 100) / 100;

/**
 * Teams in standings order, best first, with competition ranks: a tie for
 * points shares a place.
 */
export function rankByPointsFor<T extends { pointsFor: number }>(
  teams: T[],
): (T & { rank: number })[] {
  const sorted = [...teams].sort((a, b) => b.pointsFor - a.pointsFor);
  return assignCompetitionRanks(sorted, team => team.pointsFor);
}

export type StandingsTeam = {
  id: string;
  rosterId: number;
  pointsFor: number;
  finish: number | null;
  draftSlot: number | null;
  weekScores: { week: number; points: number }[];
};

export type StandingsRow<T extends StandingsTeam> = T & {
  rank: number;
  /** Points behind first place; 0 for the leader. */
  gap: number;
  bestWeek: { week: number; points: number } | null;
  /** How many weeks this team had the league's top score. */
  topScores: number;
};

/** The standings table: rank, gap to first, best week and weekly wins. */
export function buildStandings<T extends StandingsTeam>(
  teams: T[],
): StandingsRow<T>[] {
  const topByWeek = new Map<number, number>();
  for (const team of teams) {
    for (const score of team.weekScores) {
      topByWeek.set(
        score.week,
        Math.max(topByWeek.get(score.week) ?? -Infinity, score.points),
      );
    }
  }

  const ranked = rankByPointsFor(teams);
  const leader = ranked[0]?.pointsFor ?? 0;
  return ranked.map(team => {
    let bestWeek: { week: number; points: number } | null = null;
    let topScores = 0;
    for (const score of team.weekScores) {
      if (!bestWeek || score.points > bestWeek.points) {
        bestWeek = { week: score.week, points: score.points };
      }
      if (score.points > 0 && score.points === topByWeek.get(score.week)) {
        topScores += 1;
      }
    }
    return {
      ...team,
      // A settled finish wins over the live rank, so a page never disagrees
      // with the ribbon.
      rank: team.finish ?? team.rank,
      gap: roundPoints(leader - team.pointsFor),
      bestWeek,
      topScores,
    };
  });
}

/** Each week's top score, for highlighting the weekly grid. */
export function weeklyHighs(
  teams: { weekScores: { week: number; points: number }[] }[],
): Map<number, number> {
  const highs = new Map<number, number>();
  for (const team of teams) {
    for (const { week, points } of team.weekScores) {
      highs.set(week, Math.max(highs.get(week) ?? -Infinity, points));
    }
  }
  return highs;
}

export type DraftOutlier = {
  rosterId: number;
  label: string;
};

/**
 * The autodraft's oddities worth calling out: the most taken at each position,
 * and anyone left without one at all. Ties are all named.
 */
export function draftOutliers(
  countsByRoster: Map<number, PositionCounts>,
): DraftOutlier[] {
  const outliers: DraftOutlier[] = [];
  const entries = [...countsByRoster];
  if (entries.length === 0) return outliers;

  for (const position of ['QB', 'RB', 'WR', 'TE'] as const) {
    const most = Math.max(...entries.map(([, c]) => c[position]));
    if (most > 0) {
      for (const [rosterId, counts] of entries) {
        if (counts[position] === most) {
          outliers.push({ rosterId, label: `Most ${position}s (${most})` });
        }
      }
    }
    for (const [rosterId, counts] of entries) {
      if (counts[position] === 0) {
        outliers.push({ rosterId, label: `No ${position}` });
      }
    }
  }
  for (const [rosterId, counts] of entries) {
    if (counts.Other > 0) {
      outliers.push({
        rosterId,
        label: `${counts.Other} off-position pick${
          counts.Other === 1 ? '' : 's'
        }`,
      });
    }
  }
  return outliers;
}

/** The average of each position across every team, for comparison. */
export function averagePositionCounts(
  all: PositionCounts[],
): PositionCounts | null {
  if (all.length === 0) return null;
  const sum = emptyPositionCounts();
  for (const counts of all) {
    for (const group of POSITION_GROUPS) sum[group] += counts[group];
  }
  for (const group of POSITION_GROUPS) {
    sum[group] = Math.round((sum[group] / all.length) * 10) / 10;
  }
  return sum;
}
