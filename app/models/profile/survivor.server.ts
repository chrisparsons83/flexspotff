import type { SurvivorPoolInput } from './survivorProfile';
import {
  buildSurvivorCareer,
  buildSurvivorPool,
  buildSurvivorTeams,
} from './survivorProfile';
import { prisma } from '~/db.server';

/**
 * Everything the Survivor tab shows. Each pool the member played is read
 * whole, since places and the crowd's picks need every entry - at most a few
 * dozen entries and a few hundred picks apiece.
 */
export async function getSurvivorProfile(userId: string) {
  const myEntries = await prisma.survivorEntry.findMany({
    where: { userId },
    select: { id: true, survivorPoolId: true },
  });
  if (myEntries.length === 0) return { hasPlayed: false as const };

  const pools = await prisma.survivorPool.findMany({
    where: { id: { in: myEntries.map(entry => entry.survivorPoolId) } },
    include: {
      entries: {
        select: {
          id: true,
          eliminatedWeek: true,
          survivedWeek: true,
          finish: true,
          picks: { select: { week: true, team: true, result: true } },
        },
      },
    },
  });

  // One input per entry: a member could, in principle, hold two in one pool.
  const inputs: SurvivorPoolInput[] = myEntries
    .map(entry => {
      const pool = pools.find(p => p.id === entry.survivorPoolId)!;
      return {
        poolId: pool.id,
        poolName: pool.name,
        year: pool.year,
        isComplete: pool.isComplete,
        startWeek: pool.startWeek,
        entryId: entry.id,
        entries: pool.entries,
      };
    })
    .sort((a, b) => b.year - a.year || b.startWeek - a.startWeek);

  const results = inputs.map(buildSurvivorPool);

  return {
    hasPlayed: true as const,
    career: buildSurvivorCareer(inputs, results),
    pools: results,
    teams: buildSurvivorTeams(inputs),
  };
}
