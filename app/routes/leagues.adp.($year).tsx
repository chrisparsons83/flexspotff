import type { LoaderFunctionArgs } from '@remix-run/node';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import { EmptyState } from '~/components/ui/empty-state';
import { Section } from '~/components/ui/section';
import { PositionMark } from '~/components/ui/swatch';
import { Table } from '~/components/ui/table';
import { getAverageDraftPositionByYear } from '~/models/draftpick.server';
import { getLeaguesByYear } from '~/models/league.server';
import type { Player } from '~/models/players.server';
import { getPlayersByIDs } from '~/models/players.server';
import { getCurrentSeason } from '~/models/season.server';
import type { RouteHandle } from '~/utils/route-handle';

export const handle: RouteHandle = {
  title: ({ params }) => (params.year ? `${params.year} ADP` : 'ADP'),
};

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const currentSeason = await getCurrentSeason();
  if (!currentSeason) {
    throw new Response('No season set up yet', { status: 404 });
  }

  const yearParam = params.year;
  const year = !yearParam ? currentSeason.year : Number.parseInt(yearParam);

  if (isNaN(year)) {
    throw new Response('Season not found', { status: 404 });
  }

  const leagueCount = (await getLeaguesByYear(year)).filter(
    league => league.isDrafted,
  ).length;
  const adp = await getAverageDraftPositionByYear(year);
  const players = await getPlayersByIDs(adp.map(player => player.playerId));

  // Creating a map for speed purposes
  const playersMap: Map<string, Player> = new Map();
  for (const player of players) {
    playersMap.set(player.id, player);
  }

  for (const position of adp) {
    if (position._count.pickNumber !== leagueCount) {
      // Do some math if we have undrafted people
      position._max.pickNumber = 181;
      // Basically, we're reaveraging and counting undrafted as pick 180.
      // Setting undrafted to 181 makes for some weird numbers at the bottom, with an average draft
      // position worst than the actual number of picks. There isn't a great way to solve this but
      // we've picked a way, I think.
      position._avg.pickNumber =
        (position._avg.pickNumber! * position._count.pickNumber +
          181 * (leagueCount - position._count.pickNumber)) /
        leagueCount;
    }
  }
  adp.sort((a, b) => a._avg.pickNumber! - b._avg.pickNumber!);
  return typedjson({ adp, playersMap, year });
};

export default function ADP() {
  const { adp, playersMap, year } = useTypedLoaderData<typeof loader>();

  return (
    <Section
      title={`${year} Server ADP`}
      description='Average draft position across every league that has drafted. A player one league left undrafted counts as pick 181 there.'
    >
      {adp.length === 0 ? (
        <EmptyState title='No drafts yet'>
          ADP fills in once leagues have started drafting.
        </EmptyState>
      ) : (
        <Table
          headers={['Rank', 'Player', 'Position', 'ADP', 'Min', 'Max']}
          numericColumns={[0, 3, 4, 5]}
          primaryColumns={[1, 3]}
          stickyHeader
        >
          {adp.map((adpPlayer, index) => {
            const playerInfo = playersMap.get(adpPlayer.playerId);
            return (
              <tr key={adpPlayer.playerId}>
                <td className='text-right text-muted-foreground'>
                  {index + 1}
                </td>
                <td>{playerInfo?.fullName}</td>
                <td>
                  <PositionMark position={playerInfo?.position ?? null} />
                </td>
                <td className='text-right'>
                  {adpPlayer._avg.pickNumber?.toFixed(1)}
                </td>
                <td className='text-right'>{adpPlayer._min.pickNumber}</td>
                <td className='text-right'>
                  {adpPlayer._max.pickNumber === 181
                    ? 'Undrafted'
                    : adpPlayer._max.pickNumber}
                </td>
              </tr>
            );
          })}
        </Table>
      )}
    </Section>
  );
}
