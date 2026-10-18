import type { LeaderboardEntry } from '~/components/layout/leaderboard/LeaderboardTable';
import LeaderboardTable from '~/components/layout/leaderboard/LeaderboardTable';
import MemberName from '~/components/ui/MemberName';
import { ProfileLink } from '~/components/ui/profile-link';
import { LeagueMark } from '~/components/ui/swatch';
import { Table } from '~/components/ui/table';
import type { currentResultsBase } from '~/models/fsquared.server';

/** A league that has not drafted yet has no points to show. */
const isPending = (draftDate: Date | null) =>
  !draftDate || draftDate > new Date();

/** Each entry, best first, opening to the teams it picked. */
export default function FSquaredStandingsTable({
  results,
}: {
  results: currentResultsBase[];
}) {
  const entries: LeaderboardEntry[] = results.map((result, index) => ({
    id: result.id,
    rank: index + 1,
    name: (
      <ProfileLink userId={result.user.id}>
        <MemberName user={result.user} />
      </ProfileLink>
    ),
    values: [result.totalPoints.toFixed(2)],
    details: (
      <Table headers={['League', 'Team', 'Points']} numericColumns={[2]}>
        {result.teams.map(team => {
          const pending = isPending(team.league.draftDateTime);
          return (
            <tr key={team.id}>
              <td>
                <LeagueMark name={team.league.name} />
              </td>
              <td className={pending ? 'text-muted-foreground' : undefined}>
                {pending
                  ? 'Pending the draft'
                  : team.user && <MemberName user={team.user} />}
              </td>
              <td className='text-right'>{pending ? '–' : team.pointsFor}</td>
            </tr>
          );
        })}
      </Table>
    ),
  }));

  return (
    <LeaderboardTable
      entries={entries}
      nameHeading='Member'
      valueHeadings={['Points']}
      emptyMessage='No entries yet this season.'
    />
  );
}
