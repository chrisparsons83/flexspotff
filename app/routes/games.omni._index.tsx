import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import { EmptyState } from '~/components/ui/empty-state';
import { ExternalLink, Link } from '~/components/ui/link';
import { PageHeader } from '~/components/ui/page-header';
import { Table } from '~/components/ui/table';
import { HISTORY_PODIUM } from '~/libs/games/history.server';
import {
  getAllOmniSeasons,
  getOmniSeason,
  getOmniStandings,
} from '~/models/omniseason.server';
import { BRACKT_URL } from '~/utils/brackt';
import type { RouteHandle } from '~/utils/route-handle';

export const handle: RouteHandle = { title: 'Omni' };

/** Every season played here, newest first, with its final top three. */
export const loader = async () => {
  const years = (await getAllOmniSeasons()).map(season => season.year);
  const seasons = await Promise.all(
    years.map(async year => {
      const season = await getOmniSeason(year);
      return {
        year,
        leaders: season
          ? getOmniStandings(season).filter(row => row.rank <= HISTORY_PODIUM)
          : [],
      };
    }),
  );
  return typedjson({ seasons });
};

export default function OmniArchive() {
  const { seasons } = useTypedLoaderData<typeof loader>();

  return (
    <>
      <PageHeader
        title='Omni'
        description='Omni now runs on Brackt. These are the seasons played here.'
        actions={
          <ExternalLink href={BRACKT_URL} target='_blank'>
            This season on Brackt
          </ExternalLink>
        }
      />
      {seasons.length === 0 ? (
        <EmptyState title='No Omni seasons yet' />
      ) : (
        <Table
          headers={['Season', 'Rank', 'Member', 'Points']}
          numericColumns={[1, 3]}
        >
          {seasons.flatMap(season =>
            season.leaders.map((leader, index) => (
              <tr key={`${season.year}-${leader.owner}`}>
                <td>
                  {index === 0 && (
                    <Link to={`/games/omni/${season.year}`}>{season.year}</Link>
                  )}
                </td>
                <td className='text-right text-muted-foreground'>
                  {leader.rank}
                </td>
                <td>{leader.owner}</td>
                <td className='text-right'>{leader.totalPoints.toFixed(0)}</td>
              </tr>
            )),
          )}
        </Table>
      )}
    </>
  );
}
