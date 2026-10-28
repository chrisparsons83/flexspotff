import type { LoaderFunctionArgs } from '@remix-run/node';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import SeasonLeaders from '~/components/layout/games/SeasonLeaders';
import ThisWeek from '~/components/layout/games/ThisWeek';
import {
  DoubleTapBadge,
  QBPicks,
  isDoubleTap,
} from '~/components/layout/qb-streaming/QBStreamingStandingsRow';
import { getSeasonLeaders } from '~/libs/games/history.server';
import { qbStreamingSeasonTotals } from '~/models/profile/sideGameSeasons.server';
import { getQBSelectionsByWeek } from '~/models/qbselection.server';
import { getQBStreamingWeeks } from '~/models/qbstreamingweek.server';
import { getCurrentSeason } from '~/models/season.server';
import { authenticator } from '~/services/auth.server';

/** How many of this season's leaders the overview lists. */
const LEADERS = 10;

/**
 * A pick for the page: the player's name stays on the server until their game
 * kicks off, so it cannot be read from the page data either.
 */
const shownPlayer = (side: {
  nflGame: { gameStartTime: Date };
  player: { fullName: string };
  pointsScored: number;
}) => ({
  nflGame: { gameStartTime: side.nflGame.gameStartTime },
  pointsScored: side.pointsScored,
  player: {
    fullName:
      side.nflGame.gameStartTime < new Date() ? side.player.fullName : '',
  },
});

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const [season, user] = await Promise.all([
    getCurrentSeason(),
    authenticator.isAuthenticated(request),
  ]);
  if (!season) return typedjson({ year: null, week: null, leaders: [] });

  const [weeks, totals] = await Promise.all([
    getQBStreamingWeeks(season.year),
    qbStreamingSeasonTotals([season.year]),
  ]);
  // Newest first.
  const week = weeks[0] ?? null;
  const [leaders, selections] = await Promise.all([
    getSeasonLeaders(totals, season.year, LEADERS),
    week ? getQBSelectionsByWeek(week.id) : [],
  ]);

  return typedjson({
    year: season.year,
    week: week && {
      id: week.id,
      number: week.week,
      status: week.isScored
        ? 'Scored.'
        : week.isOpen
        ? 'The options are set: picks are open.'
        : 'The options are not set yet.',
      canEnter: !!user && week.isOpen && !week.isScored,
    },
    leaders: leaders.map(leader => {
      const pick = selections.find(
        selection => selection.userId === leader.user.id,
      );
      return {
        ...leader,
        week: pick
          ? (
              pick.standardPlayer.pointsScored + pick.deepPlayer.pointsScored
            ).toFixed(2)
          : undefined,
        pick: pick && {
          standardPlayer: shownPlayer(pick.standardPlayer),
          deepPlayer: shownPlayer(pick.deepPlayer),
        },
      };
    }),
  });
};

export default function QBStreamingOverview() {
  const { year, week, leaders } = useTypedLoaderData<typeof loader>();

  return (
    <>
      <ThisWeek
        week={week?.number ?? null}
        status={week?.status ?? ''}
        entryHref={week?.canEnter ? `entries/${week.id}` : undefined}
        standingsHref={
          week && year ? `standings/${year}/${week.number}` : undefined
        }
      />
      {year && (
        <SeasonLeaders
          year={year}
          week={week?.number}
          leaders={leaders.map(leader => ({
            ...leader,
            details: <QBPicks pick={leader.pick} />,
            tag: isDoubleTap(leader.pick) && <DoubleTapBadge />,
          }))}
          standingsPath='standings'
          valueHeading='Points'
        />
      )}
    </>
  );
}
