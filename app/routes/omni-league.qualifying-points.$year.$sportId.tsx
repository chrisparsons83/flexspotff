import type { LoaderFunctionArgs } from '@remix-run/node';
import clsx from 'clsx';
import { useTypedLoaderData } from 'remix-typedjson';
import GoBox from '~/components/ui/GoBox';
import { getPlayersAndAssociatedPick } from '~/models/omniplayer.server';
import { getOmniSeason } from '~/models/omniseason.server';
import { getOmniSportEvents } from '~/models/omnisportevent.server';

export const loader = async ({ params }: LoaderFunctionArgs) => {
  if (!params.year) {
    throw new Error('No year param specified');
  }
  if (!params.sportId) {
    throw new Error('No sportId param specified');
  }

  const year = Number(params.year);
  const { sportId } = params;

  const seasonResults = await getOmniSeason(year);

  if (!seasonResults) {
    throw new Error('No season found');
  }

  // TODO: Make a getOmniSportEventsBySportId function
  const allSportEvents = await getOmniSportEvents();
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
    throw new Error('Sport not found');
  }

  const qualifyingPointsMap = sportEvents
    .flatMap(sportEvent => sportEvent.omniSportEventPoints)
    .reduce((acc, entry) => {
      acc.set(entry.playerId, (acc.get(entry.playerId) || 0) + entry.points);
      return acc;
    }, new Map<string, number>());

  const rankedQualifyingPoints = Array.from(qualifyingPointsMap.values())
    .sort()
    .reverse();

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

export default function OmniQualifyingPointsYearIndex() {
  const { currentSport, pointsLeaderboard, sports, year } =
    useTypedLoaderData<typeof loader>();

  const sportsArray = sports.map(sport => ({
    label: sport.name,
    url: `/omni-league/qualifying-points/${year}/${sport.id}`,
  }));

  return (
    <>
      <h2>{year} Omni Qualifying Points</h2>
      <h3>Sport: {currentSport.name}</h3>
      <div className='float-right mb-4'>
        <GoBox options={sportsArray} buttonText='Choose Sport' />
      </div>
      <table>
        <thead>
          <tr>
            <th></th>
            <th>Player</th>
            <th>Manager</th>
            <th>Points</th>
          </tr>
        </thead>
        <tbody>
          {pointsLeaderboard.map((position, index) => {
            return (
              <tr
                key={position.player.id}
                className={clsx(
                  index % 2 === 0 ? 'bg-gray-900' : 'bg-gray-800',
                  'p-2',
                )}
              >
                <td className='pl-1'>
                  <div
                    className={clsx(
                      'mx-auto w-8 h-8 flex justify-center items-center font-bold text-sm',
                    )}
                  >
                    {position.rank}
                  </div>
                </td>
                <td>{position.player.displayName}</td>
                <td>{position.player.draftPick?.team.user?.discordName}</td>
                <td>{position.points}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}
