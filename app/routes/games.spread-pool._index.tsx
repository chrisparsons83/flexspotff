import type { LoaderFunctionArgs } from '@remix-run/node';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import SeasonLeaders from '~/components/layout/games/SeasonLeaders';
import ThisWeek from '~/components/layout/games/ThisWeek';
import { LockedBets } from '~/components/layout/spread-pool/SpreadPoolStandingsRow';
import { getSeasonLeaders } from '~/libs/games/history.server';
import {
  getPoolGamePicksWonLossWeek,
  getPoolGamesPicksByPoolWeek,
} from '~/models/poolgamepicks.server';
import { getPoolWeeksByYear } from '~/models/poolweek.server';
import { getPoolWeekMissedTotalByUserAndYearAndWeek } from '~/models/poolweekmissed.server';
import { spreadPoolSeasonTotals } from '~/models/profile/sideGameSeasons.server';
import { STARTING_BANK } from '~/models/profile/spreadPoolProfile';
import { getCurrentSeason } from '~/models/season.server';
import { authenticator } from '~/services/auth.server';

/** How many of this season's leaders the overview lists. */
const LEADERS = 10;

/** A week's won or lost, signed. */
const signed = (net: number) => (net > 0 ? `+${net}` : `${net}`);

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const [season, user] = await Promise.all([
    getCurrentSeason(),
    authenticator.isAuthenticated(request),
  ]);
  if (!season)
    return typedjson({
      year: null,
      week: null,
      leaders: [],
      entry: null,
      standingsWeek: null,
    });

  const [weeks, totals] = await Promise.all([
    getPoolWeeksByYear(season.year),
    spreadPoolSeasonTotals([season.year]),
  ]);
  // Newest first; the open week if there is one.
  const week = weeks.find(poolWeek => poolWeek.isOpen) ?? weeks[0] ?? null;

  const [leaders, picks, wonLoss, missed] = await Promise.all([
    getSeasonLeaders(totals, season.year, LEADERS),
    week ? getPoolGamesPicksByPoolWeek(week) : [],
    week ? getPoolGamePicksWonLossWeek(week) : [],
    week
      ? getPoolWeekMissedTotalByUserAndYearAndWeek(season.year, week.weekNumber)
      : [],
  ]);
  // Bets stay private until their game kicks off.
  const now = new Date();
  const lockedPicks = picks.filter(
    pick => pick.poolGame.game.gameStartTime < now && pick.amountBet !== 0,
  );
  const weekNet = new Map<string, number>();
  for (const row of [...wonLoss, ...missed]) {
    weekNet.set(
      row.userId,
      (weekNet.get(row.userId) ?? 0) + (row._sum.resultWonLoss ?? 0),
    );
  }

  // Your own bets, saved or not, while the week is still open to you.
  const myBets = user
    ? picks.filter(pick => pick.userId === user.id && pick.amountBet > 0)
    : [];
  const atStake = myBets.reduce((sum, pick) => sum + pick.amountBet, 0);

  return typedjson({
    year: season.year,
    entry:
      user && week?.isOpen && !week.isWeekScored
        ? {
            saved: myBets.length > 0,
            summary: `${myBets.length} ${
              myBets.length === 1 ? 'bet' : 'bets'
            }, ${atStake} points on the line.`,
          }
        : null,
    // The newest week with results; this one until it is scored.
    standingsWeek:
      weeks.find(poolWeek => poolWeek.isWeekScored)?.weekNumber ?? null,
    week: week && {
      id: week.id,
      number: week.weekNumber,
      // A member's own saved-picks line says the week is open; the status
      // is for everyone else.
      status: week.isWeekScored
        ? 'Scored.'
        : week.isOpen
        ? user
          ? ''
          : 'Lines are set: picks are open until each game kicks off.'
        : 'Lines are not set yet.',
      canEnter: !!user && week.isOpen && !week.isWeekScored,
    },
    leaders: leaders.map(leader => {
      const net = weekNet.get(leader.user.id);
      return {
        ...leader,
        week: net === undefined ? undefined : signed(net),
        picks: lockedPicks.filter(pick => pick.userId === leader.user.id),
      };
    }),
  });
};

export default function SpreadPoolOverview() {
  const { year, week, leaders, entry, standingsWeek } =
    useTypedLoaderData<typeof loader>();

  return (
    <>
      <ThisWeek
        week={week?.number ?? null}
        status={week?.status ?? ''}
        entryHref={week?.canEnter ? `entries/${week.id}` : undefined}
        entry={entry ?? undefined}
        standingsHref={
          standingsWeek && year
            ? `standings/${year}/${standingsWeek}`
            : undefined
        }
        standingsWeek={standingsWeek ?? undefined}
      />
      {year && (
        <SeasonLeaders
          year={year}
          week={week?.number}
          leaders={leaders.map(leader => ({
            ...leader,
            details: <LockedBets picks={leader.picks} />,
          }))}
          standingsPath='standings'
          valueHeading='Bank'
          formatValue={net => `${STARTING_BANK + net}`}
        />
      )}
    </>
  );
}
