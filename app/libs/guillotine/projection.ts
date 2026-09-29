/**
 * Live projections for a guillotine week in progress: how many points each
 * surviving team is on course for, and who that puts below the chop line.
 */

/**
 * Scores a projected stat line with a league's own scoring settings. Sleeper's
 * stat keys and scoring keys are the same names, which is what makes this a
 * plain weighted sum; checked against Sleeper's own projected totals it lands
 * within 0.05 points.
 */
export function scoreProjection(
  stats: Record<string, unknown> | null | undefined,
  scoringSettings: Record<string, number>,
): number {
  if (!stats) return 0;
  let points = 0;
  for (const [key, weight] of Object.entries(scoringSettings)) {
    const value = stats[key];
    if (typeof value === 'number') points += value * weight;
  }
  return Math.round(points * 100) / 100;
}

export type GameState = 'pre_game' | 'in_game' | 'complete';

/**
 * A regulation game runs about three hours of wall clock. Used to judge how far
 * through a game is until the real game clock is available.
 */
const GAME_LENGTH_MINUTES = 185;

/**
 * How much of a game has been played, from 0 to 1.
 *
 * Estimated from the time since kickoff, since the game clock is not stored.
 * Held short of 1 while the game is on, so a player in a long game is never
 * treated as finished before the game says it is.
 */
export function gameProgress({
  state,
  kickoff,
  now,
}: {
  state: GameState | null;
  kickoff: Date | null;
  now: Date;
}): number {
  if (state === 'complete') return 1;
  if (state !== 'in_game' || !kickoff) return 0;
  const elapsed = (now.getTime() - kickoff.getTime()) / 60_000;
  return Math.min(Math.max(elapsed / GAME_LENGTH_MINUTES, 0), 0.95);
}

export type StarterLine = {
  sleeperId: string;
  /** Points scored so far. */
  points: number;
  /** Projected points for the whole game, in the league's scoring. */
  projection: number;
  /** How much of this player's game is done, 0 to 1. */
  progress: number;
};

/**
 * A starter's projected finish: what they have, plus the share of their
 * projection still to be played. Two minutes before half time the game is
 * about half done, so that is their points plus a bit over half their
 * projection. Once the game is over, only real points count.
 */
export function projectStarter(starter: StarterLine): number {
  if (starter.progress >= 1) return starter.points;
  return starter.points + starter.projection * (1 - starter.progress);
}

export type TeamProjection = {
  points: number;
  projected: number;
  /** Starters whose game is not over, including ones yet to kick off. */
  playersRemaining: number;
  /** Starters whose game has not kicked off. */
  playersYetToPlay: number;
};

/** Empty lineup slots come through as '0' and count for nothing. */
export function projectTeam(starters: StarterLine[]): TeamProjection {
  const filled = starters.filter(s => s.sleeperId !== '0');
  const points = filled.reduce((sum, s) => sum + s.points, 0);
  const projected = filled.reduce((sum, s) => sum + projectStarter(s), 0);
  return {
    points: round(points),
    projected: round(projected),
    playersRemaining: filled.filter(s => s.progress < 1).length,
    playersYetToPlay: filled.filter(s => s.progress === 0).length,
  };
}

export type ChopLineEntry<T> = T & {
  /** 1 is safest. */
  rank: number;
  /** On course to be chopped. */
  onTheBlock: boolean;
  /**
   * For the team on the block, how far it is behind the lowest safe team; for
   * everyone else, how far ahead of the team on the block. Projected points.
   */
  margin: number | null;
};

/**
 * Orders the surviving teams by projected total and marks the one heading for
 * the chop. Ties on projection fall back to points already scored, then
 * starters left to play, since that team has more still in hand.
 */
export function chopLine<T extends TeamProjection>(
  teams: T[],
): ChopLineEntry<T>[] {
  const sorted = [...teams].sort(
    (a, b) =>
      b.projected - a.projected ||
      b.points - a.points ||
      b.playersRemaining - a.playersRemaining,
  );
  const bottom = sorted.at(-1);
  const lastSafe = sorted.at(-2);

  return sorted.map((team, index) => {
    const onTheBlock = sorted.length > 1 && team === bottom;
    let margin: number | null = null;
    if (bottom && lastSafe) {
      margin = onTheBlock
        ? round(bottom.projected - lastSafe.projected)
        : round(team.projected - bottom.projected);
    }
    return { ...team, rank: index + 1, onTheBlock, margin };
  });
}

const round = (value: number) => Math.round(value * 100) / 100;
