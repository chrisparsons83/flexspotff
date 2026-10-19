import { prisma } from '~/db.server';
import { poolTitle } from '~/libs/survivor/views';
import { getLocksWeeksByYear } from '~/models/locksweek.server';
import { getPoolWeeksByYear } from '~/models/poolweek.server';
import { getQBStreamingWeeks } from '~/models/qbstreamingweek.server';
import { getLatestSurvivorPools } from '~/models/survivor.server';

type WeekState = { week: number; isOpen: boolean; isScored: boolean };

/** Where a weekly game stands, in a few words. */
const weekStatus = (state: WeekState | null) =>
  !state
    ? 'No weeks yet'
    : state.isScored
    ? `Week ${state.week} scored`
    : state.isOpen
    ? `Week ${state.week} open for picks`
    : `Week ${state.week} not open yet`;

export type GameThisWeek = {
  name: string;
  to: string;
  status: string;
  /** Whether the game has a My entries page. */
  entries: boolean;
};

/**
 * Every game in the Games section and where its week stands, in the order the
 * sitemap lists them. Shared by the games overview and the home page.
 */
export async function getGamesThisWeek(
  season: { year: number; isOpenForFSquared: boolean } | null,
): Promise<GameThisWeek[]> {
  const year = season?.year;

  const [qb, pool, locks, dfs, survivor] = await Promise.all([
    year ? getQBStreamingWeeks(year) : [],
    year ? getPoolWeeksByYear(year) : [],
    year ? getLocksWeeksByYear(year) : [],
    year
      ? prisma.dFSSurvivorUserWeek.findFirst({
          where: { year, isScored: true },
          orderBy: { week: 'desc' },
          select: { week: true },
        })
      : null,
    getLatestSurvivorPools(),
  ]);

  const qbWeek = qb[0];
  const poolWeek = pool.find(week => week.isOpen) ?? pool[0];
  const locksWeek = locks.find(week => week.isOpen) ?? locks[0];

  return [
    {
      name: 'QB streaming',
      to: '/games/qb-streaming',
      status: weekStatus(
        qbWeek
          ? {
              week: qbWeek.week,
              isOpen: qbWeek.isOpen,
              isScored: qbWeek.isScored,
            }
          : null,
      ),
      entries: true,
    },
    {
      name: 'Spread pool',
      to: '/games/spread-pool',
      status: weekStatus(
        poolWeek
          ? {
              week: poolWeek.weekNumber,
              isOpen: poolWeek.isOpen,
              isScored: poolWeek.isWeekScored,
            }
          : null,
      ),
      entries: true,
    },
    {
      name: 'Locks challenge',
      to: '/games/locks-challenge',
      status: weekStatus(
        locksWeek
          ? {
              week: locksWeek.weekNumber,
              isOpen: locksWeek.isOpen,
              isScored: locksWeek.isWeekScored,
            }
          : null,
      ),
      entries: true,
    },
    {
      name: 'DFS survivor',
      to: '/games/dfs-survivor',
      status: dfs ? `Scored through week ${dfs.week}` : 'No weeks scored yet',
      entries: true,
    },
    {
      name: 'F²',
      to: '/games/f-squared',
      status: season?.isOpenForFSquared ? 'Entries open' : 'Entries closed',
      entries: true,
    },
    {
      name: 'Survivor',
      to: '/games/survivor',
      status:
        survivor.length > 0
          ? survivor.map(pool => poolTitle(pool)).join(', ')
          : 'No pools yet',
      entries: false,
    },
    {
      name: 'Omni',
      to: '/games/omni',
      status: 'Past seasons. Omni now runs on Brackt.',
      entries: false,
    },
  ];
}
