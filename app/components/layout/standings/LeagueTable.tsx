import clsx from 'clsx';
import type { GetLeaguesByYearElement } from '~/models/league.server';
import { RANK_COLORS, isLeagueName } from '~/utils/constants';

type Props = {
  league: GetLeaguesByYearElement;
};

export default function LeagueTable({ league }: Props) {
  const leagueName = league.name.toLocaleLowerCase();

  return (
    <section>
      <h3>{league.name} League</h3>
      <table>
        <thead>
          <tr>
            <th></th>
            <th>Name</th>
            <th>Record</th>
            <th>Median</th>
            <th>PF</th>
            <th>PA</th>
          </tr>
        </thead>
        <tbody>
          {league.teams.map((team, index) => (
            <tr
              key={team.id}
              className={clsx(index % 2 === 0 ? 'bg-gray-900' : 'bg-gray-800')}
            >
              <td>
                <div
                  className={clsx(
                    isLeagueName(leagueName) && RANK_COLORS[leagueName],
                    'mx-auto w-8 h-8 flex justify-center items-center font-bold text-sm',
                  )}
                >
                  {index + 1}
                </div>
              </td>
              <td>{team.user?.discordName}</td>
              <td>
                {team.wins}-{team.losses}-{team.ties}
              </td>
              <td>
                {team.medianWins}-{team.medianLosses}-{team.medianTies}
              </td>
              <td>{team.pointsFor}</td>
              <td>{team.pointsAgainst}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
