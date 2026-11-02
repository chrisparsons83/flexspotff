import type { LoaderFunctionArgs } from '@remix-run/node';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import SeasonLeaders from '~/components/layout/games/SeasonLeaders';
import ThisWeek from '~/components/layout/games/ThisWeek';
import { LockedPicksList } from '~/components/layout/locks-challenge/LocksChallengeStandingsRow';
import {
  getMemberStanding,
  getSeasonLeaders,
} from '~/libs/games/history.server';
import { getLocksGamesByYearAndWeek } from '~/models/locksgame.server';
import {
  getLocksGamePicksWonLossWeek,
  getLocksGamesPicksByLocksWeek,
} from '~/models/locksgamepicks.server';
import { getLocksWeeksByYear } from '~/models/locksweek.server';
import { locksWeekPoints } from '~/models/profile/sideGameScoring';
import { locksSeasonTotals } from '~/models/profile/sideGameSeasons.server';
import { getCurrentSeason } from '~/models/season.server';
import { authenticator } from '~/services/auth.server';
import { getLocksWeekCutoff, isLocksWeekLocked } from '~/utils/locks';
import { getCurrentTime } from '~/utils/time';

/** How many of this season's leaders the overview lists. */
const LEADERS = 10;

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
      me: null,
      entry: null,
      standingsWeek: null,
    });

  const [weeks, totals] = await Promise.all([
    getLocksWeeksByYear(season.year),
    locksSeasonTotals([season.year]),
  ]);
  // Newest first; the open week if there is one.
  const week = weeks.find(locksWeek => locksWeek.isOpen) ?? weeks[0] ?? null;

  const [leaders, picks, wonLoss, games] = await Promise.all([
    getSeasonLeaders(totals, season.year, LEADERS),
    week ? getLocksGamesPicksByLocksWeek(week) : [],
    week ? getLocksGamePicksWonLossWeek(week) : [],
    week ? getLocksGamesByYearAndWeek(season.year, week.weekNumber) : [],
  ]);
  // A pick is public once its game kicks off, or once the whole week locks;
  // the week standings page has the same rule.
  const now = getCurrentTime();
  const weekLocked = isLocksWeekLocked(
    getLocksWeekCutoff(games.map(({ game }) => game)),
    now,
  );
  const lockedPicks = picks.filter(
    pick =>
      (pick.locksGame.game.gameStartTime < now || weekLocked) &&
      pick.isActive !== 0,
  );
  const weekPoints = new Map(
    wonLoss.map(row => [row.userId, locksWeekPoints(row._sum)]),
  );

  // Your own picks, while the week is still open to you.
  const myPicks = user
    ? picks.filter(pick => pick.userId === user.id && pick.isActive !== 0)
    : [];

  const me = user
    ? await getMemberStanding(totals, season.year, user.id)
    : null;

  return typedjson({
    me,
    year: season.year,
    entry:
      user && week?.isOpen && !week.isWeekScored
        ? {
            saved: myPicks.length > 0,
            stats: [{ label: 'Picks', value: `${myPicks.length}` }],
          }
        : null,
    // The newest week with results; this one until it is scored.
    standingsWeek:
      weeks.find(locksWeek => locksWeek.isWeekScored)?.weekNumber ?? null,
    week: week && {
      id: week.id,
      number: week.weekNumber,
      status: week.isWeekScored
        ? 'Scored.'
        : week.isOpen
        ? 'Open for picks until 1:00 pm Eastern on Sunday, or each game’s kickoff if sooner.'
        : 'Not open yet.',
      canEnter: !!user && week.isOpen && !week.isWeekScored,
    },
    leaders: leaders.map(leader => ({
      ...leader,
      week: weekPoints.has(leader.user.id)
        ? `${weekPoints.get(leader.user.id)}`
        : undefined,
      picks: lockedPicks.filter(pick => pick.userId === leader.user.id),
    })),
  });
};

export default function LocksChallengeOverview() {
  const { year, week, leaders, me, entry, standingsWeek } =
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
          me={me}
          year={year}
          week={week?.number}
          leaders={leaders.map(leader => ({
            ...leader,
            details: <LockedPicksList picks={leader.picks} />,
          }))}
          standingsPath='standings'
          valueHeading='Points'
          formatValue={points => `${points}`}
        />
      )}
    </>
  );
}
