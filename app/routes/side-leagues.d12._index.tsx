import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import MemberName from '~/components/ui/MemberName';
import { EmptyState } from '~/components/ui/empty-state';
import { Link } from '~/components/ui/link';
import { Section } from '~/components/ui/section';
import { Table } from '~/components/ui/table';
import { getAllD12SeasonYears } from '~/models/d12season.server';
import {
  computeD12Leaderboard,
  getD12WeekScoresBySeasonYear,
} from '~/models/d12weekscore.server';

/** How many of each season's leaders the history lists. */
const PODIUM = 3;

/** Every D12 season with the top of its final (or current) leaderboard. */
export const loader = async () => {
  const years = await getAllD12SeasonYears();
  const seasons = await Promise.all(
    years.map(async year => ({
      year,
      leaders: computeD12Leaderboard(await getD12WeekScoresBySeasonYear(year))
        .slice(0, PODIUM)
        .map(entry => ({
          userId: entry.userId,
          rank: entry.rank,
          discordName: entry.discordName,
          discordUsername: entry.discordUsername,
          totalPoints: entry.totalPoints,
        })),
    })),
  );
  return typedjson({ seasons });
};

export default function D12History() {
  const { seasons } = useTypedLoaderData<typeof loader>();

  if (seasons.length === 0)
    return (
      <EmptyState title='No D12 seasons yet'>
        Each season appears here once its leagues are set up on Sleeper.
      </EmptyState>
    );

  return (
    <Section title='History'>
      <Table
        headers={['Season', 'Rank', 'Manager', 'Points']}
        numericColumns={[1, 3]}
      >
        {seasons.flatMap(season =>
          season.leaders.map((leader, index) => (
            <tr key={`${season.year}-${leader.userId}`}>
              <td>
                {index === 0 && (
                  <Link to={`/side-leagues/d12/${season.year}`}>
                    {season.year}
                  </Link>
                )}
              </td>
              <td className='text-right text-muted-foreground'>
                {leader.rank}
              </td>
              <td>
                <Link
                  to={`/side-leagues/d12/${season.year}/user/${leader.userId}`}
                  variant='quiet'
                >
                  <MemberName user={leader} />
                </Link>
              </td>
              <td className='text-right'>{leader.totalPoints.toFixed(2)}</td>
            </tr>
          )),
        )}
      </Table>
    </Section>
  );
}
