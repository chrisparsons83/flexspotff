import type { SummaryRow } from '~/components/ui/summary-card';
import { prisma } from '~/db.server';
import { getSeasonLeaders, HISTORY_PODIUM } from '~/libs/games/history.server';
import { getLastWeeks, type WeeklyGame } from '~/libs/games/last-week.server';
import { entryLabel, poolTitle } from '~/libs/survivor/views';
import { getLocksWeeksByYear } from '~/models/locksweek.server';
import {
  getAllOmniSeasons,
  getOmniSeason,
  getOmniStandings,
} from '~/models/omniseason.server';
import { getPoolWeeksByYear } from '~/models/poolweek.server';
import type { SeasonTotals } from '~/models/profile/sideGameSeasons.server';
import {
  dfsSurvivorSeasonTotals,
  fSquaredSeasonTotals,
  locksSeasonTotals,
  qbStreamingSeasonTotals,
  spreadPoolSeasonTotals,
} from '~/models/profile/sideGameSeasons.server';
import { STARTING_BANK } from '~/models/profile/spreadPoolProfile';
import { getQBStreamingWeeks } from '~/models/qbstreamingweek.server';
import { getLatestSurvivorPools } from '~/models/survivor.server';
import { getUsersByIds } from '~/models/user.server';
import { BRACKT_URL } from '~/utils/brackt';

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

export type GameOverview = {
  name: string;
  to: string;
  status: string;
  /** The reader's entry for the week, while picks are open to them. */
  statusHref?: string;
  /** A link on another site, after the status. */
  statusLink?: { label: string; href: string };
  /** The top of this season's table, or each pool for Survivor. */
  rows: SummaryRow[];
  /** The top of the newest scored week, for the weekly games. */
  lastWeek?: { week: number; rows: SummaryRow[] } | null;
  /** What to say when there are no rows. */
  empty: string;
};

const NO_SCORES = 'No scores yet this season.';

/** The most rows a week's top can run to, ties and all. */
const MAX_WEEK_ROWS = 5;

/**
 * Every game in the Games section, where its week stands and the top of its
 * table this season, in the order the sitemap lists them. Shared by the games
 * overview and the home page.
 *
 * Entry links in the status are for signed-in readers.
 */
export async function getGamesOverview(
  season: {
    year: number;
    isOpenForFSquared: boolean;
    isOpenForDFSSurvivor: boolean;
  } | null,
  {
    signedIn,
    leaders,
    weekLeaders = 0,
    lastWeeks: preloaded,
  }: {
    signedIn: boolean;
    leaders: number;
    /** How many of each weekly game's newest week to list; none by default. */
    weekLeaders?: number;
    /** Each game's newest scored week, when the caller has already loaded it. */
    lastWeeks?: Awaited<ReturnType<typeof getLastWeeks>>;
  },
): Promise<GameOverview[]> {
  const year = season?.year;
  const years = year ? [year] : [];
  const noTotals: SeasonTotals = new Map();

  const [qb, pool, locks, dfs, survivor, omni, ...totals] = await Promise.all([
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
    getLatestOmniPodium(),
    year ? qbStreamingSeasonTotals(years) : noTotals,
    year ? spreadPoolSeasonTotals(years) : noTotals,
    year ? locksSeasonTotals(years) : noTotals,
    year ? dfsSurvivorSeasonTotals(years) : noTotals,
    year ? fSquaredSeasonTotals(years) : noTotals,
  ] as const);

  const [qbLeaders, poolLeaders, locksLeaders, dfsLeaders, fSquaredLeaders] =
    year
      ? await Promise.all(
          totals.map(game => getSeasonLeaders(game, year, leaders)),
        )
      : [[], [], [], [], []];

  const leaderRows = (
    rows: Awaited<ReturnType<typeof getSeasonLeaders>>,
    format: (total: number) => string,
  ): SummaryRow[] =>
    rows.map(row => ({
      key: row.user.id,
      rank: row.rank,
      user: row.user,
      value: format(row.total),
    }));
  const twoPlaces = (total: number) => total.toFixed(2);

  const lastWeeks =
    year && weekLeaders > 0 ? preloaded ?? (await getLastWeeks(year)) : null;
  const weekUsers = lastWeeks
    ? await getUsersByIds(
        Object.values(lastWeeks).flatMap(
          week =>
            week?.results
              .filter(result => result.rank <= weekLeaders)
              .map(result => result.userId) ?? [],
        ),
      )
    : [];
  /** The top of a weekly game's newest scored week, ties included. */
  const weekTop = (game: WeeklyGame) => {
    const week = lastWeeks?.[game];
    if (!week) return null;
    return {
      week: week.week,
      // Ties stay in, up to a few rows: a week everyone scored 0 in would
      // otherwise list them all.
      rows: week.results
        .filter(result => result.rank <= weekLeaders)
        .slice(0, MAX_WEEK_ROWS)
        .map(result => {
          const user = weekUsers.find(u => u.id === result.userId);
          return {
            key: result.userId,
            rank: result.rank,
            user: {
              id: result.userId,
              discordName: user?.discordName ?? 'Former member',
              discordUsername: user?.discordUsername ?? null,
            },
            value: result.label,
          };
        }),
    };
  };

  const qbWeek = qb[0];
  const poolWeek = pool.find(week => week.isOpen) ?? pool[0];
  const locksWeek = locks.find(week => week.isOpen) ?? locks[0];

  /** The entry page for a week, if the reader can still enter it. */
  const entryHref = (
    game: string,
    week: { id: string; isOpen: boolean; isScored: boolean } | undefined,
  ) =>
    signedIn && week?.isOpen && !week.isScored
      ? `/games/${game}/entries/${week.id}`
      : undefined;

  return [
    {
      name: 'QB Streaming',
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
      statusHref: entryHref('qb-streaming', qbWeek),
      rows: leaderRows(qbLeaders, twoPlaces),
      lastWeek: weekTop('qbStreaming'),
      empty: NO_SCORES,
    },
    {
      name: 'Spread Pool',
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
      statusHref: entryHref(
        'spread-pool',
        poolWeek && { ...poolWeek, isScored: poolWeek.isWeekScored },
      ),
      rows: leaderRows(poolLeaders, net => `${STARTING_BANK + net}`),
      lastWeek: weekTop('spreadPool'),
      empty: NO_SCORES,
    },
    {
      name: 'Locks Challenge',
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
      statusHref: entryHref(
        'locks-challenge',
        locksWeek && { ...locksWeek, isScored: locksWeek.isWeekScored },
      ),
      rows: leaderRows(locksLeaders, points => `${points}`),
      lastWeek: weekTop('locks'),
      empty: NO_SCORES,
    },
    {
      name: 'DFS Survivor',
      to: '/games/dfs-survivor',
      status: dfs ? `Scored through week ${dfs.week}` : 'No weeks scored yet',
      statusHref:
        signedIn && season?.isOpenForDFSSurvivor
          ? '/games/dfs-survivor/entries'
          : undefined,
      rows: leaderRows(dfsLeaders, twoPlaces),
      lastWeek: weekTop('dfsSurvivor'),
      empty: NO_SCORES,
    },
    {
      name: 'F²',
      to: '/games/f-squared',
      status: season?.isOpenForFSquared ? 'Entries open' : 'Entries closed',
      statusHref:
        signedIn && season?.isOpenForFSquared
          ? '/games/f-squared/entries'
          : undefined,
      rows: leaderRows(fSquaredLeaders, twoPlaces),
      empty: NO_SCORES,
    },
    {
      name: 'Survivor',
      // Straight to the pool while one is running: there is only ever one.
      to: survivorLink(survivor),
      ...survivorSummary(survivor, leaders * 2),
      empty: 'No pools yet.',
    },
    {
      name: 'Omni',
      // Straight to the season while there is only one.
      to: omni?.onlySeason ? `/games/omni/${omni.year}` : '/games/omni',
      status: omni ? `Final ${omni.year} standings.` : '',
      statusLink: { label: 'Omni now runs on Brackt', href: BRACKT_URL },
      rows:
        omni?.leaders.map(leader => ({
          key: leader.owner,
          rank: leader.rank,
          label: leader.owner,
          value: leader.totalPoints.toFixed(0),
        })) ?? [],
      empty: 'No seasons played here.',
    },
  ];
}

type SurvivorPool = Awaited<ReturnType<typeof getLatestSurvivorPools>>[number];

/** The pool being played, or the Survivor page when none is. */
function survivorLink(pools: SurvivorPool[]) {
  const live = pools.filter(pool => !pool.isComplete);
  return live.length === 1
    ? `/games/survivor/${live[0]!.id}`
    : '/games/survivor';
}

/**
 * The season's pools, one row each. While one pool is running and few enough
 * are left in it, the card is about that pool instead: who is still alive.
 */
function survivorSummary(pools: SurvivorPool[], maxNames: number) {
  const live = pools.filter(pool => !pool.isComplete);
  const alive =
    live.length === 1
      ? live[0]!.entries.filter(entry => entry.eliminatedWeek === null)
      : [];

  if (alive.length > 0 && alive.length <= maxNames) {
    const pool = live[0]!;
    return {
      // Only one pool runs at a time, so its name adds nothing.
      status: `${alive.length} of ${pool.entries.length} alive.`,
      rows: alive
        .map(entry => ({ entry, name: entryLabel(entry) }))
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(({ entry, name }) => ({
          key: entry.user?.id ?? name,
          user: entry.user,
          label: name,
          value: '',
        })),
    };
  }

  return {
    status: pools.length > 0 ? `${pools[0]!.year} pools` : 'No pools yet',
    rows: pools.map(pool => ({
      key: pool.id,
      label: poolTitle(pool),
      value: survivorStanding(pool),
    })),
  };
}

/** Who won a finished pool, or how many are still in. */
function survivorStanding(pool: SurvivorPool) {
  if (pool.isComplete) {
    const winners = pool.entries.filter(entry => entry.finish === 1);
    return winners.length > 0
      ? winners.map(entry => entryLabel(entry)).join(', ')
      : 'Finished';
  }
  const alive = pool.entries.filter(entry => entry.eliminatedWeek === null);
  return `${alive.length} of ${pool.entries.length} alive`;
}

/** The last Omni season played here and its top three. */
async function getLatestOmniPodium() {
  const seasons = await getAllOmniSeasons();
  const season = seasons[0] ? await getOmniSeason(seasons[0].year) : null;
  if (!season) return null;
  return {
    year: season.year,
    onlySeason: seasons.length === 1,
    leaders: getOmniStandings(season).filter(row => row.rank <= HISTORY_PODIUM),
  };
}
