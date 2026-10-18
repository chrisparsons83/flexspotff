import { CurrentSeason } from '~/components/layout/profile/StatusText';
import MemberName from '~/components/ui/MemberName';
import { EmptyState } from '~/components/ui/empty-state';
import { Link } from '~/components/ui/link';
import { ProfileLink } from '~/components/ui/profile-link';
import { Section } from '~/components/ui/section';
import { Table } from '~/components/ui/table';
import type { GameHistory as History } from '~/libs/games/history.server';

/**
 * A game's History tab: the top three of every season, and every member who
 * has won it, most titles first.
 */
export default function GameHistory({
  history,
  standingsPath,
  valueHeading,
  formatValue = value => value.toFixed(2),
}: {
  history: History;
  /** The standings for a year, e.g. `/games/spread-pool/standings`. */
  standingsPath: string;
  valueHeading: string;
  formatValue?: (total: number) => string;
}) {
  if (history.seasons.length === 0) {
    return <EmptyState title='No seasons played yet' />;
  }

  return (
    <>
      <Section
        title='Seasons'
        description='The top three of every season, newest first.'
      >
        <Table
          headers={['Season', 'Rank', 'Member', valueHeading]}
          numericColumns={[1, 3]}
        >
          {history.seasons.flatMap(season =>
            season.leaders.map((leader, index) => (
              <tr key={`${season.year}-${leader.userId}`}>
                <td>
                  {index === 0 && (
                    <>
                      <Link to={`${standingsPath}/${season.year}`}>
                        {season.year}
                      </Link>
                      {season.inProgress && <CurrentSeason />}
                    </>
                  )}
                </td>
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
            )),
          )}
        </Table>
      </Section>

      {history.titles.length > 0 && (
        <Section
          title='Titles'
          description='Seasons won, counting only seasons that are over. A tie for first is a title for each.'
        >
          <Table headers={['Member', 'Titles']} numericColumns={[1]}>
            {history.titles.map(row => (
              <tr key={row.user.id}>
                <td>
                  <ProfileLink userId={row.user.id}>
                    <MemberName user={row.user} />
                  </ProfileLink>
                </td>
                <td className='text-right'>{row.titles}</td>
              </tr>
            ))}
          </Table>
        </Section>
      )}
    </>
  );
}
