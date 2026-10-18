import type { LeaderboardEntry } from './LeaderboardTable';
import LeaderboardTable from './LeaderboardTable';
import GoBox from '~/components/ui/GoBox';
import MemberName from '~/components/ui/MemberName';
import { Link } from '~/components/ui/link';
import { Section } from '~/components/ui/section';
import { assignCompetitionRanks } from '~/utils/rank';
import { yearOptions } from '~/utils/years';

// Described structurally rather than off the model return types, so the
// JSON-serialised shapes the loaders hand back still satisfy it.
type SeasonTotal = {
  teamId: string;
  _sum: { pointsScored: number | null };
};

type SeasonTeam = {
  id: string;
  league: { name: string };
  user: { discordName: string; discordUsername?: string | null } | null;
};

type Props = {
  year: number;
  /** Per-team season totals, best first. */
  leaderboard: SeasonTotal[];
  teams: SeasonTeam[];
  /** Newest year offered in the year picker. */
  maxYear: number;
  /** The newest week with scores, for the link to the weekly board. */
  newestWeek: number | null;
};

/**
 * Season points-for standings across every league.
 *
 * Shared by /leagues/leaderboard and /leagues/leaderboard/:year, which were
 * copies of each other and had already drifted.
 */
export default function SeasonLeaderboard({
  year,
  leaderboard,
  teams,
  maxYear,
  newestWeek,
}: Props) {
  const entries: LeaderboardEntry[] = assignCompetitionRanks(
    leaderboard,
    position => position._sum.pointsScored ?? 0,
  )
    .map((position): LeaderboardEntry | null => {
      const team = teams.find(team => team.id === position.teamId);
      if (!team) return null;

      return {
        id: position.teamId,
        rank: position.rank,
        name: team.user ? <MemberName user={team.user} /> : 'Unclaimed team',
        league: team.league.name,
        values: [position._sum.pointsScored?.toFixed(2)],
      };
    })
    .filter((entry): entry is LeaderboardEntry => entry !== null);

  return (
    <Section
      title={`${year} season leaderboard`}
      description='Regular-season points for, across every league.'
      action={
        <div className='flex flex-wrap items-center gap-4'>
          {newestWeek && (
            <Link to={`/leagues/leaderboard/${year}/${newestWeek}`}>
              By week
            </Link>
          )}
          <GoBox
            options={yearOptions(maxYear, y => `/leagues/leaderboard/${y}`)}
            buttonText='Season'
          />
        </div>
      }
    >
      <LeaderboardTable entries={entries} valueHeadings={['Points for']} />
    </Section>
  );
}
