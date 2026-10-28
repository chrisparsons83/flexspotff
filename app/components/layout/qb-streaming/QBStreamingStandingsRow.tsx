import type { LeaderboardEntry } from '~/components/layout/leaderboard/LeaderboardTable';
import MemberName from '~/components/ui/MemberName';
import { Badge } from '~/components/ui/badge';
import { ProfileLink } from '~/components/ui/profile-link';

type QBPickSide = {
  nflGame: { gameStartTime: Date };
  player: { fullName: string };
  pointsScored: number;
};

export type QBPick = { standardPlayer: QBPickSide; deepPlayer: QBPickSide };

/** A pick shows once its game has kicked off. */
const started = (side: QBPickSide) => side.nflGame.gameStartTime < new Date();

/**
 * The same quarterback on both lists, once their game has kicked off: before
 * then it would give the pick away.
 */
export const isDoubleTap = (pick: QBPick | undefined) =>
  !!pick &&
  started(pick.standardPlayer) &&
  started(pick.deepPlayer) &&
  pick.standardPlayer.player.fullName === pick.deepPlayer.player.fullName;

/** Marks a member who took one quarterback for both picks. */
export function DoubleTapBadge() {
  return (
    <Badge
      size='sm'
      fill='position-qb'
      label='Double tap'
      className='text-sm text-muted-foreground'
    />
  );
}

/**
 * The week's two picks, each with what it scored once its game has kicked
 * off. Side by side where there is room, one above the other on a phone.
 */
export function QBPicks({ pick }: { pick?: QBPick }) {
  return (
    <dl className='flex flex-wrap gap-x-12 gap-y-1'>
      {(
        [
          ['Standard', 'standardPlayer'],
          ['Deep', 'deepPlayer'],
        ] as const
      ).map(([label, key]) => {
        const side = pick?.[key];
        return (
          <div key={key} className='flex gap-3'>
            <dt className='w-16 text-muted-foreground'>{label}</dt>
            <dd>
              {!side ? (
                'No pick'
              ) : started(side) ? (
                <>
                  {side.player.fullName}{' '}
                  <span className='ml-2 font-semibold tabular-nums'>
                    {side.pointsScored.toFixed(2)}
                  </span>
                </>
              ) : (
                'Pending'
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

/**
 * A QB streaming standings row: rank, member and points, opening to the week's
 * two picks once their games have kicked off.
 */
export function qbStreamingStandingsEntry({
  rank,
  user,
  pointsScored,
  pick,
}: {
  rank?: number;
  user: {
    userId: string;
    discordName: string;
    discordUsername?: string | null;
  };
  pointsScored: number;
  pick?: QBPick;
}): LeaderboardEntry {
  return {
    id: user.userId,
    rank: rank ?? 0,
    name: (
      <span className='inline-flex flex-wrap items-center gap-x-3'>
        <ProfileLink userId={user.userId}>
          <MemberName user={user} />
        </ProfileLink>
        {isDoubleTap(pick) && <DoubleTapBadge />}
      </span>
    ),
    values: [pointsScored.toFixed(2)],
    details: <QBPicks pick={pick} />,
  };
}
