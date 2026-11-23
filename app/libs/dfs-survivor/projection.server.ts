import {
  type DfsLineupProjection,
  type DfsSlotProjection,
  projectDfsLineup,
} from './projection';
import { prisma } from '~/db.server';
import type { GameState } from '~/libs/guillotine/projection';

/** One member's week, as much of it as projecting needs. */
export type DfsWeekToProject = {
  week: number;
  isScored: boolean;
  entries: { position: string; playerId: string; nflGameId: string }[];
};

export type DfsWeekProjection = DfsLineupProjection & {
  /** Each pick's projection, by lineup slot. */
  bySlot: Map<string, DfsSlotProjection>;
};

/**
 * The projected score of each of a member's weeks that has picks in and is not
 * yet scored, from the stored schedule and player scores. A scored week is left
 * out: its entries carry the real score.
 */
export async function projectDfsWeeks(
  year: number,
  weeks: DfsWeekToProject[],
  now: Date,
): Promise<Map<number, DfsWeekProjection>> {
  const open = weeks.filter(week => !week.isScored && week.entries.length > 0);
  if (open.length === 0) return new Map();

  const entries = open.flatMap(week => week.entries);
  const [games, scores] = await Promise.all([
    prisma.nFLGame.findMany({
      where: { id: { in: [...new Set(entries.map(e => e.nflGameId))] } },
      select: { id: true, status: true, gameStartTime: true },
    }),
    prisma.playerWeekScore.findMany({
      where: {
        year,
        week: { in: open.map(week => week.week) },
        playerId: { in: [...new Set(entries.map(e => e.playerId))] },
      },
      select: { playerId: true, week: true, points: true, projection: true },
    }),
  ]);
  const gameById = new Map(games.map(game => [game.id, game]));
  const scoreByKey = new Map(
    scores.map(score => [`${score.playerId}:${score.week}`, score]),
  );

  const projections = new Map<number, DfsWeekProjection>();
  for (const week of open) {
    const lineup = projectDfsLineup(
      week.entries.map(entry => {
        const game = gameById.get(entry.nflGameId);
        const score = scoreByKey.get(`${entry.playerId}:${week.week}`);
        return {
          points: score?.points ?? null,
          projection: score?.projection ?? null,
          game: game
            ? { state: game.status as GameState, kickoff: game.gameStartTime }
            : null,
        };
      }),
      now,
    );
    projections.set(week.week, {
      ...lineup,
      bySlot: new Map(
        week.entries.map((entry, index) => [
          entry.position,
          lineup.slots[index]!,
        ]),
      ),
    });
  }
  return projections;
}
