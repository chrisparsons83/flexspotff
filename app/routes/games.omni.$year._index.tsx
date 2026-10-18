import type { LoaderFunctionArgs } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import { Section } from '~/components/ui/section';
import { Table } from '~/components/ui/table';
import { getOmniSeason, getOmniStandings } from '~/models/omniseason.server';

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const year = Number(params.year);
  const seasonResults = await getOmniSeason(year);
  if (!seasonResults) {
    throw new Response('No Omni that year', { status: 404 });
  }

  const leaderboard = getOmniStandings(seasonResults);

  return { leaderboard, year };
};

export default function OmniStandings() {
  const { leaderboard } = useLoaderData<typeof loader>();

  return (
    <Section title='Standings'>
      <Table
        headers={[
          'Rank',
          'Member',
          'Picks remaining',
          'Picks scored',
          'Points',
        ]}
        numericColumns={[0, 2, 3, 4]}
        primaryColumns={[1, 4]}
      >
        {leaderboard.map(position => (
          <tr key={position.owner}>
            <td className='text-right text-muted-foreground'>
              {position.rank}
            </td>
            <td>{position.owner}</td>
            <td className='text-right'>
              {position.remainingPlayers.toFixed(0)}
            </td>
            <td className='text-right'>{position.picksWithPoints}</td>
            <td className='text-right font-semibold'>
              {position.totalPoints.toFixed(0)}
            </td>
          </tr>
        ))}
      </Table>
    </Section>
  );
}
