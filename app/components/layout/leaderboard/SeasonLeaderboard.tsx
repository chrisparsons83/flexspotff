import type { LeaderboardEntry } from './LeaderboardTable';
import LeaderboardTable from './LeaderboardTable';
import GoBox from '~/components/ui/GoBox';
import { FIRST_YEAR, RANK_COLORS, isLeagueName } from '~/utils/constants';
import { assignCompetitionRanks } from '~/utils/rank';

// Described structurally rather than off the model return types, so the
// JSON-serialised shapes the loaders hand back still satisfy it.
type SeasonTotal = {
  teamId: string;
  _sum: { pointsScored: number | null };
};

type SeasonTeam = {
  id: string;
  league: { name: string };
  user: { discordName: string } | null;
};

type Props = {
  heading: string;
  /** Per-team season totals, best first. */
  leaderboard: SeasonTotal[];
  teams: SeasonTeam[];
  /** Newest year offered in the year picker. */
  maxYear: number;
};

/**
 * Season points-for standings across every league.
 *
 * Shared by /leagues/leaderboard and /leagues/leaderboard/:year, which were
 * copies of each other and had already drifted - the undated one was applying
 * league colours without the isLeagueName guard.
 */
export default function SeasonLeaderboard({
  heading,
  leaderboard,
  teams,
  maxYear,
}: Props) {
  const yearArray = Array.from(
    { length: maxYear - FIRST_YEAR + 1 },
    (_, i) => FIRST_YEAR + i,
  )
    .reverse()
    .map(yearNumber => ({
      label: `${yearNumber}`,
      url: `/leagues/leaderboard/${yearNumber}`,
    }));

  const entries: LeaderboardEntry[] = assignCompetitionRanks(
    leaderboard,
    position => position._sum.pointsScored ?? 0,
  )
    .map((position): LeaderboardEntry | null => {
      const team = teams.find(team => team.id === position.teamId);
      if (!team) return null;

      const teamLeague = team.league.name.toLocaleLowerCase();

      return {
        id: position.teamId,
        rank: position.rank,
        name: team.user?.discordName || 'Missing user',
        badgeClassName: isLeagueName(teamLeague)
          ? RANK_COLORS[teamLeague]
          : undefined,
        values: [position._sum.pointsScored?.toFixed(2)],
      };
    })
    .filter((entry): entry is LeaderboardEntry => entry !== null);

  return (
    <>
      <h2>{heading}</h2>
      <div className='float-right mb-4'>
        <GoBox options={yearArray} buttonText='Choose Year' />
      </div>
      <LeaderboardTable entries={entries} valueHeadings={['Points For']} />
    </>
  );
}
