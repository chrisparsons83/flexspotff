import {
  type GameState,
  gameProgress,
  projectStarter,
  roundPoints,
} from '~/libs/guillotine/projection';

/**
 * The projected score of a DFS Survivor week still being played: what each pick
 * has scored, plus what the rest of their game is expected to add. Uses the
 * same rule as the guillotine's live chop line.
 */

export type DfsSlotInput = {
  /** DFS Survivor points from their stored stat line; null until Sleeper has one. */
  points: number | null;
  /** Their projection for the whole game. */
  projection: number | null;
  game: { state: GameState; kickoff: Date } | null;
};

export type DfsSlotProjection = {
  /**
   * `final` once their game is over and scored, `live` while it is on, and
   * `projected` before kickoff - or after the final whistle while the stat
   * line has yet to arrive, since a missing line is not a real 0.
   */
  state: 'final' | 'live' | 'projected';
  /** Points scored so far. */
  points: number;
  /** Where they are on course to finish. */
  projected: number;
};

export function projectDfsSlot(
  { points, projection, game }: DfsSlotInput,
  now: Date,
): DfsSlotProjection {
  const state = game?.state ?? null;
  if (state === 'complete' && points !== null) {
    return { state: 'final', points, projected: points };
  }
  if (state === 'in_game') {
    const scored = points ?? 0;
    const progress = gameProgress({ state, kickoff: game!.kickoff, now });
    return {
      state: 'live',
      points: scored,
      projected: roundPoints(
        projectStarter({
          sleeperId: '',
          points: scored,
          projection: projection ?? 0,
          progress,
        }),
      ),
    };
  }
  return { state: 'projected', points: 0, projected: projection ?? 0 };
}

/** A projected score: points so far, and where they are on course to finish. */
export type ProjectedScore = { points: number; projected: number };

export type DfsLineupProjection = {
  slots: DfsSlotProjection[];
  total: ProjectedScore;
  /** At least one pick's game has started, so the week is under way. */
  hasKickedOff: boolean;
};

export function projectDfsLineup(
  slots: DfsSlotInput[],
  now: Date,
): DfsLineupProjection {
  const projected = slots.map(slot => projectDfsSlot(slot, now));
  return {
    slots: projected,
    total: {
      points: roundPoints(projected.reduce((sum, s) => sum + s.points, 0)),
      projected: roundPoints(
        projected.reduce((sum, s) => sum + s.projected, 0),
      ),
    },
    hasKickedOff: slots.some(
      slot => slot.game !== null && slot.game.state !== 'pre_game',
    ),
  };
}
