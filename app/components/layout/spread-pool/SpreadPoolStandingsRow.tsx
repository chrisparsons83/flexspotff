import type { LeaderboardEntry } from '~/components/layout/leaderboard/LeaderboardTable';
import MemberName from '~/components/ui/MemberName';
import { ProfileLink } from '~/components/ui/profile-link';
import type {
  PoolGamePicksWonLoss,
  getPoolGamesPicksByPoolWeek,
} from '~/models/poolgamepicks.server';
import type { User } from '~/models/user.server';

type LockedPicks = Awaited<ReturnType<typeof getPoolGamesPicksByPoolWeek>>;

/** The bets a member has riding on games that have kicked off. */
function LockedBets({ picks }: { picks: LockedPicks }) {
  if (picks.length === 0) {
    return <p className='text-muted-foreground'>No locked bets.</p>;
  }
  return (
    <ul className='grid gap-1'>
      {picks.map(pick => {
        const spreadAmount =
          pick.teamBetId === pick.poolGame.game.homeTeamId
            ? pick.poolGame.homeSpread
            : -1 * pick.poolGame.homeSpread;
        const spread =
          spreadAmount === 0
            ? 'even'
            : spreadAmount > 0
            ? `+${spreadAmount}`
            : `${spreadAmount}`;
        const result =
          pick.resultWonLoss! > 0
            ? { label: 'Won', tone: 'text-positive' }
            : pick.resultWonLoss! < 0
            ? { label: 'Lost', tone: 'text-negative' }
            : pick.isScored
            ? { label: 'Pushed', tone: 'text-muted-foreground' }
            : { label: 'Bet', tone: 'text-muted-foreground' };

        return (
          <li key={pick.id}>
            <span className={result.tone}>{result.label}</span> {pick.amountBet}{' '}
            on {pick.teamBet.mascot} {spread}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * A spread pool standings row: rank, member, bank, record and return on what
 * they bet, opening to the bets they have locked in this week.
 */
export function spreadPoolStandingsEntry({
  rank,
  user,
  poolGameWonLoss,
  picksLocked,
  initialBudget = 1000,
}: {
  rank: number | undefined;
  user: User;
  poolGameWonLoss: PoolGamePicksWonLoss;
  initialBudget?: number;
  picksLocked?: LockedPicks;
}): LeaderboardEntry {
  const { amountBet, resultWonLoss, isWin, isLoss, isTie } =
    poolGameWonLoss._sum;
  const returnOnEquity = amountBet
    ? `${(((resultWonLoss || 0) / (amountBet || 1)) * 100).toFixed(2)}%`
    : 'No bets';

  return {
    id: user.id,
    rank: rank ?? 0,
    name: (
      <ProfileLink userId={user.id}>
        <MemberName user={user} />
      </ProfileLink>
    ),
    values: [
      initialBudget + (resultWonLoss || 0),
      `${isWin}-${isLoss}-${isTie}`,
      returnOnEquity,
    ],
    details: picksLocked && <LockedBets picks={picksLocked} />,
  };
}

export const SPREAD_POOL_HEADINGS = ['Bank', 'W-L-T', 'Return'];
