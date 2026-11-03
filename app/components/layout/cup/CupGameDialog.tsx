import { useFetcher } from '@remix-run/react';
import { useEffect } from 'react';
import MemberName from '~/components/ui/MemberName';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { PositionMark } from '~/components/ui/swatch';
import type { CupBracketData } from '~/libs/cup/bracket.server';
import type { LineupStarter, WeekLineup } from '~/libs/cup/lineups';
import type { CupGameLineups } from '~/libs/cup/lineups.server';
import type { loader } from '~/routes/resources.cup-game.$gameId';
import { cn } from '~/utils';

type CupGame = NonNullable<CupBracketData>['cupGames'][number];

const STATE_LABEL: Record<LineupStarter['state'], string> = {
  complete: 'Final',
  in_game: 'Playing',
  pre_game: 'Yet to Play',
  bye: 'No Game',
};

/** The game a dialog is showing, with its round's name and weeks as labels. */
export type OpenedCupGame = {
  game: CupGame;
  round: string;
  weeks: string | null;
};

/**
 * One cup game's two lineups, week by week. Mounted when a score is clicked,
 * and the lineups load then: a whole bracket's worth would be a lot to send
 * with the page for the few anyone opens.
 */
export default function CupGameDialog({
  game,
  round,
  weeks,
  onClose,
}: OpenedCupGame & { onClose: () => void }) {
  const fetcher = useFetcher<typeof loader>();
  const { load } = fetcher;
  useEffect(() => {
    load(`/resources/cup-game/${game.id}`);
  }, [load, game.id]);

  const loading = fetcher.state !== 'idle' || fetcher.data === undefined;
  const sides = fetcher.data?.sides ?? [];
  const managers = [game.topTeam, game.bottomTeam].flatMap(side =>
    side ? [side] : [],
  );

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className='max-w-3xl'>
        <DialogHeader>
          <DialogTitle>{round} Lineups</DialogTitle>
          {weeks && <DialogDescription>{weeks}</DialogDescription>}
        </DialogHeader>
        {loading ? (
          <p className='text-sm text-muted-foreground'>Loading lineups…</p>
        ) : sides.length === 0 ? (
          <p className='text-sm text-muted-foreground'>
            No lineups for this game.
          </p>
        ) : (
          <div
            className={cn('grid gap-6', sides.length > 1 && 'sm:grid-cols-2')}
          >
            {sides.map(side => (
              <Side
                key={side.teamId}
                side={side}
                user={
                  managers.find(manager => manager.teamId === side.teamId)?.team
                    .user
                }
              />
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Side({
  side,
  user,
}: {
  side: CupGameLineups['sides'][number];
  user: NonNullable<CupGame['topTeam']>['team']['user'] | undefined;
}) {
  const { total, weeks } = side;
  return (
    <section className='grid content-start gap-3'>
      <div className='flex items-baseline justify-between gap-2 border-b border-border pb-2'>
        <h3 className='truncate font-bold'>
          {user ? <MemberName user={user} /> : 'Unclaimed Team'}
        </h3>
        <p className='shrink-0 text-right tabular-nums'>
          <span className='font-bold'>{total.points.toFixed(2)}</span>
          {total.projected !== null && (
            <span className='ml-2 text-sm text-muted-foreground'>
              Proj {total.projected.toFixed(2)}
            </span>
          )}
        </p>
      </div>
      {weeks.map(week => (
        <Week key={week.week} week={week} showHeading={weeks.length > 1} />
      ))}
    </section>
  );
}

function Week({
  week,
  showHeading,
}: {
  week: WeekLineup;
  showHeading: boolean;
}) {
  // Once a week is over its projection is its score, so a column of it would
  // only repeat Points.
  const showProjected = week.projected !== null && !week.finished;
  return (
    <div className='grid gap-1'>
      {showHeading && (
        <h4 className='flex items-baseline justify-between gap-2 text-sm font-semibold'>
          Week {week.week}
          <span className='font-normal tabular-nums text-muted-foreground'>
            {week.points.toFixed(2)}
            {showProjected && ` / ${week.projected!.toFixed(2)}`}
          </span>
        </h4>
      )}
      {week.placeholder && (
        <p className='text-sm text-muted-foreground'>
          {week.placeholder === 'optimal'
            ? `Best projected lineup, until the actual one shows when week ${week.week} starts.`
            : `As set on Sleeper so far. Locks in when week ${week.week} starts.`}
        </p>
      )}
      {week.starters.length === 0 ? (
        <p className='text-sm text-muted-foreground'>No lineup set yet.</p>
      ) : (
        <table className='w-full text-sm tabular-nums'>
          <thead className='text-muted-foreground'>
            <tr>
              <th className='w-12 py-0.5 font-semibold'>
                <span className='sr-only'>Position</span>
              </th>
              <th className='py-0.5 pl-2 text-left font-semibold'>Player</th>
              <th className='py-0.5 pl-2 text-right font-semibold'>Points</th>
              {showProjected && (
                <th className='py-0.5 pl-2 text-right font-semibold'>Proj</th>
              )}
            </tr>
          </thead>
          <tbody>
            {week.starters.map((starter, index) => (
              <tr key={`${starter.sleeperId}-${index}`}>
                <td className='py-0.5'>
                  <PositionMark position={starter.position} />
                </td>
                <td className='py-0.5 pl-2'>
                  {starter.name}
                  {!week.finished && (
                    <span className='block text-muted-foreground'>
                      {STATE_LABEL[starter.state]}
                    </span>
                  )}
                </td>
                <td className='py-0.5 pl-2 text-right'>
                  {starter.state === 'pre_game'
                    ? '–'
                    : starter.points.toFixed(2)}
                </td>
                {showProjected && (
                  <td className='py-0.5 pl-2 text-right text-muted-foreground'>
                    {starter.projected?.toFixed(2)}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
