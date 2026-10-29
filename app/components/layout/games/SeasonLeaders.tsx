import type { ReactNode } from 'react';
import LeaderboardTable from '~/components/layout/leaderboard/LeaderboardTable';
import MemberName from '~/components/ui/MemberName';
import { Link } from '~/components/ui/link';
import { ProfileLink } from '~/components/ui/profile-link';
import { Section } from '~/components/ui/section';

export type SeasonLeader = {
  rank: number;
  user: { id: string; discordName: string; discordUsername: string | null };
  total: number;
  /** This week's score, already formatted. Missing when they have none. */
  week?: string;
  /** This week's picks, opened from the row. */
  details?: ReactNode;
};

/**
 * The top of this season's standings for a game's overview, with this week's
 * score beside each season total when the game is played by the week.
 */
export default function SeasonLeaders({
  year,
  week,
  leaders,
  standingsPath,
  valueHeading,
  formatValue = value => value.toFixed(2),
}: {
  year: number;
  /** The week in the This week column. Leave it out for no column. */
  week?: number | null;
  leaders: SeasonLeader[];
  standingsPath: string;
  valueHeading: string;
  formatValue?: (total: number) => string;
}) {
  const withWeek = week !== undefined && week !== null;

  return (
    <Section
      title={`${year} Leaders`}
      action={<Link to={standingsPath}>Full Standings</Link>}
    >
      <LeaderboardTable
        nameHeading='Member'
        valueHeadings={[valueHeading, ...(withWeek ? [`Week ${week}`] : [])]}
        emptyMessage='No scores yet this season.'
        entries={leaders.map(leader => ({
          id: leader.user.id,
          rank: leader.rank,
          name: (
            <ProfileLink userId={leader.user.id}>
              <MemberName user={leader.user} />
            </ProfileLink>
          ),
          values: [
            formatValue(leader.total),
            ...(withWeek ? [leader.week ?? '–'] : []),
          ],
          details: leader.details,
        }))}
      />
    </Section>
  );
}
