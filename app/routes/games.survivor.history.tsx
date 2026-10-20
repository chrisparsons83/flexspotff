import type { LoaderFunctionArgs } from '@remix-run/node';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import PoolCards from '~/components/layout/survivor/PoolCards';
import { EmptyState } from '~/components/ui/empty-state';
import { ProfileLink } from '~/components/ui/profile-link';
import { Section } from '~/components/ui/section';
import { Table } from '~/components/ui/table';
import { requireSurvivorAccess } from '~/libs/survivor/access.server';
import { getSurvivorPools } from '~/libs/survivor/pools.server';
import type { RouteHandle } from '~/utils/route-handle';

export const handle: RouteHandle = { title: 'History' };

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await requireSurvivorAccess(request);
  return typedjson(await getSurvivorPools());
};

export default function SurvivorHistory() {
  const { years, allTime } = useTypedLoaderData<typeof loader>();
  if (years.length === 0)
    return (
      <EmptyState title='No survivor pools yet'>
        A pool appears here once it is set up on Sleeper.
      </EmptyState>
    );

  return (
    <>
      {allTime.length > 0 && (
        <Section
          title='All time'
          description='Members ranked by pools won, then by their longest run of winning picks.'
        >
          <Table
            headers={[
              'Member',
              'Pools',
              'Wins',
              'Longest run',
              'Winning picks',
            ]}
            numericColumns={[1, 2, 3, 4]}
            primaryColumns={[2]}
          >
            {allTime.map(row => (
              <tr key={row.userId}>
                <td>
                  <ProfileLink userId={row.userId} tab='survivor'>
                    {row.name}
                  </ProfileLink>
                </td>
                <td className='text-right'>{row.pools}</td>
                <td className='text-right font-semibold'>{row.wins || '–'}</td>
                <td className='text-right'>{row.longestRun}</td>
                <td className='text-right'>{row.weeksSurvived}</td>
              </tr>
            ))}
          </Table>
        </Section>
      )}
      {years.map(({ year, pools }) => (
        <Section key={year} title={year}>
          <PoolCards pools={pools} />
        </Section>
      ))}
    </>
  );
}
