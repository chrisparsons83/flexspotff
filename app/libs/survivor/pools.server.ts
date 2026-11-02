import { buildAllTime, entryLabel } from '~/libs/survivor/views';
import { getSurvivorHistory } from '~/models/survivor.server';

export type SurvivorPools = Awaited<ReturnType<typeof getSurvivorPools>>;

/**
 * Every pool, newest year first, with how it stands or who won it, and the
 * all-time table of members by pools won.
 */
export async function getSurvivorPools() {
  const pools = await getSurvivorHistory();

  const cards = pools.map(pool => {
    const alive = pool.entries.filter(entry => entry.eliminatedWeek === null);
    const lastWeek = Math.max(
      pool.startWeek,
      ...pool.entries.flatMap(entry => entry.picks.map(pick => pick.week)),
    );
    // Through the last week every surviving pick has been settled.
    const settledWeek = Math.max(0, ...alive.map(entry => entry.survivedWeek));
    return {
      id: pool.id,
      name: pool.name,
      year: pool.year,
      source: pool.source,
      startWeek: pool.startWeek,
      lastWeek,
      isComplete: pool.isComplete,
      inviteUrl: pool.isComplete ? null : pool.inviteUrl,
      entryCount: pool.entries.length,
      aliveCount: alive.length,
      settledWeek,
      winners: pool.entries
        .filter(entry => pool.isComplete && entry.finish === 1)
        .map(entry => ({
          name: entryLabel(entry),
          userId: entry.user?.id ?? null,
          survivedWeek: entry.survivedWeek,
        })),
    };
  });

  return {
    years: [...new Set(cards.map(card => card.year))].map(year => ({
      year,
      pools: cards.filter(card => card.year === year),
    })),
    allTime: buildAllTime(pools),
  };
}
