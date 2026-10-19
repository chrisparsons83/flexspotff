import type { LoaderFunctionArgs } from '@remix-run/node';
import { useTypedLoaderData } from 'remix-typedjson';
import GoBox from '~/components/ui/GoBox';
import MemberName from '~/components/ui/MemberName';
import { Section } from '~/components/ui/section';
import { Table } from '~/components/ui/table';
import { getPlayersAndAssociatedPick } from '~/models/omniplayer.server';
import { getOmniSeason } from '~/models/omniseason.server';
import { getOmniSportEvents } from '~/models/omnisportevent.server';

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const year = Number(params.year);

  const seasonResults = await getOmniSeason(year);
  if (!seasonResults) {
    throw new Response('No Omni that year', { status: 404 });
  }

  // TODO: Make a getOmniSportEventsBySportId function
  const allSportEvents = await getOmniSportEvents();
  // The first sport when none is picked.
  const sportId = params.sportId ?? allSportEvents[0]?.sportId;
  const sportEvents = allSportEvents.filter(
    sportEvent => sportEvent.sportId === sportId,
  );

  const players = await getPlayersAndAssociatedPick(seasonResults.id);

  const sports = Array.from(
    new Set(allSportEvents.map(sportEvent => sportEvent.sport.id)),
  )
    .map(
      sportId =>
        allSportEvents.find(sportEvent => sportEvent.sport.id === sportId)
          ?.sport,
    )
    .filter(sport => sport !== undefined);

  const currentSport = sports.find(sport => sport.id === sportId);
  if (!currentSport) {
    throw new Response('Sport not found', { status: 404 });
  }

  const qualifyingPointsMap = sportEvents
    .flatMap(sportEvent => sportEvent.omniSportEventPoints)
    .reduce((acc, entry) => {
      acc.set(entry.playerId, (acc.get(entry.playerId) || 0) + entry.points);
      return acc;
    }, new Map<string, number>());

  const rankedQualifyingPoints = Array.from(qualifyingPointsMap.values()).sort(
    (a, b) => b - a,
  );

  const pointsLeaderboard = Array.from(qualifyingPointsMap.entries())
    .map(([playerId, points]) => {
      const player = players.find(player => player.id === playerId);
      if (!player) {
        throw new Error('Player not found');
      }

      return {
        rank: rankedQualifyingPoints.findIndex(rank => rank === points) + 1,
        player,
        points,
      };
    })
    .sort((a, b) => {
      if (a.points < b.points) {
        return 1;
      } else if (a.points > b.points) {
        return -1;
      } else {
        return a.player.displayName.localeCompare(b.player.displayName);
      }
    });

  return { currentSport, pointsLeaderboard, sports, year };
};

export default function OmniQualifyingPoints() {
  const { currentSport, pointsLeaderboard, sports, year } =
    useTypedLoaderData<typeof loader>();

  return (
    <Section
      title={`Qualifying points: ${currentSport.name}`}
      action={
        <GoBox
          buttonText='Sport'
          options={sports.map(sport => ({
            label: sport.name,
            url: `/games/omni/${year}/qualifying-points/${sport.id}`,
          }))}
        />
      }
    >
      <Table
        headers={['Rank', 'Player', 'Manager', 'Points']}
        numericColumns={[0, 3]}
        primaryColumns={[1, 3]}
      >
        {pointsLeaderboard.map(position => (
          <tr key={position.player.id}>
            <td className='text-right text-muted-foreground'>
              {position.rank}
            </td>
            <td>{position.player.displayName}</td>
            <td>
              {position.player.draftPick?.team.user && (
                <MemberName user={position.player.draftPick.team.user} />
              )}
            </td>
            <td className='text-right'>{position.points.toFixed(2)}</td>
          </tr>
        ))}
      </Table>
    </Section>
  );
}
