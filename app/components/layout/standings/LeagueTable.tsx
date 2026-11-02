import MemberName from '~/components/ui/MemberName';
import { ProfileLink } from '~/components/ui/profile-link';
import { Table } from '~/components/ui/table';
import { WinLoss } from '~/components/ui/win-loss';
import type { GetLeaguesByYearElement } from '~/models/league.server';

type Props = {
  league: Pick<GetLeaguesByYearElement, 'name' | 'hasMedianScoring'> & {
    teams: GetLeaguesByYearElement['teams'];
  };
};

/** One league's table, best first, as the league sync left it. */
export default function LeagueTable({ league }: Props) {
  const median = league.hasMedianScoring;
  const headers = [
    'Rank',
    'Manager',
    'Record',
    ...(median ? ['Median'] : []),
    'PF',
    'PA',
  ];
  const pf = headers.indexOf('PF');

  return (
    <Table
      headers={headers}
      numericColumns={[0, pf, pf + 1]}
      primaryColumns={[1, 2]}
      caption={`${league.name} standings`}
    >
      {league.teams.map((team, index) => (
        <tr key={team.id}>
          <td className='text-right text-muted-foreground'>{index + 1}</td>
          <td>
            {team.user ? (
              <ProfileLink userId={team.user.id}>
                <MemberName user={team.user} />
              </ProfileLink>
            ) : (
              'Unclaimed team'
            )}
          </td>
          <td>
            <WinLoss wins={team.wins} losses={team.losses} ties={team.ties} />
          </td>
          {median && (
            <td>
              <WinLoss
                wins={team.medianWins}
                losses={team.medianLosses}
                ties={team.medianTies}
              />
            </td>
          )}
          <td className='text-right'>{team.pointsFor.toFixed(2)}</td>
          <td className='text-right'>{team.pointsAgainst.toFixed(2)}</td>
        </tr>
      ))}
    </Table>
  );
}
