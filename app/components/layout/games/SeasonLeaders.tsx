import MemberName from '~/components/ui/MemberName';
import { Link } from '~/components/ui/link';
import { ProfileLink } from '~/components/ui/profile-link';
import { Section } from '~/components/ui/section';
import { Table } from '~/components/ui/table';

export type SeasonLeader = {
  rank: number;
  user: { id: string; discordName: string; discordUsername: string | null };
  total: number;
};

/** The top of this season's standings, for a game's overview. */
export default function SeasonLeaders({
  year,
  leaders,
  standingsPath,
  valueHeading,
  formatValue = value => value.toFixed(2),
}: {
  year: number;
  leaders: SeasonLeader[];
  standingsPath: string;
  valueHeading: string;
  formatValue?: (total: number) => string;
}) {
  return (
    <Section
      title={`${year} leaders`}
      action={<Link to={standingsPath}>Full standings</Link>}
    >
      {leaders.length === 0 ? (
        <p className='text-muted-foreground'>No scores yet this season.</p>
      ) : (
        <Table
          headers={['Rank', 'Member', valueHeading]}
          numericColumns={[0, 2]}
        >
          {leaders.map(leader => (
            <tr key={leader.user.id}>
              <td className='text-right text-muted-foreground'>
                {leader.rank}
              </td>
              <td>
                <ProfileLink userId={leader.user.id}>
                  <MemberName user={leader.user} />
                </ProfileLink>
              </td>
              <td className='text-right'>{formatValue(leader.total)}</td>
            </tr>
          ))}
        </Table>
      )}
    </Section>
  );
}
