import type { LoaderFunctionArgs } from '@remix-run/node';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import MemberName from '~/components/ui/MemberName';
import { Section } from '~/components/ui/section';
import { PositionMark } from '~/components/ui/swatch';
import { Table } from '~/components/ui/table';
import { requireLeague } from '~/libs/leagues/page.server';
import { getWaiverTransactionsByLeague } from '~/models/waiver.server';

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const league = await requireLeague({ params, request });
  const transactions = await getWaiverTransactionsByLeague(league.id);
  return typedjson({ transactions });
};

export default function LeagueTransactions() {
  const { transactions } = useTypedLoaderData<typeof loader>();
  const weeks = [...new Set(transactions.map(claim => claim.week))];

  return (
    <>
      {weeks.map(week => (
        <Section
          key={week}
          title={`Week ${week} waivers`}
          description='Highest bid first; on an equal bid, the better waiver priority.'
        >
          <Table
            headers={['Manager', 'Added', 'Dropped', 'Bid', 'Result']}
            numericColumns={[3]}
            primaryColumns={[1, 4]}
          >
            {transactions
              .filter(claim => claim.week === week)
              .map(claim => (
                <tr key={claim.id}>
                  <td>
                    {claim.user ? (
                      <MemberName user={claim.user} />
                    ) : (
                      'Unknown manager'
                    )}
                  </td>
                  <td>
                    <span className='inline-flex items-center gap-2'>
                      <PositionMark
                        position={claim.addPlayer?.position ?? null}
                      />
                      {claim.addPlayer?.fullName ?? claim.addSleeperId}
                    </span>
                  </td>
                  <td>{claim.dropPlayer?.fullName ?? 'Nobody'}</td>
                  <td className='text-right'>{claim.bid}</td>
                  <td
                    className={
                      claim.status === 'complete'
                        ? undefined
                        : 'text-muted-foreground'
                    }
                  >
                    {claim.status === 'complete' ? 'Won' : 'Lost'}
                  </td>
                </tr>
              ))}
          </Table>
        </Section>
      ))}
    </>
  );
}
