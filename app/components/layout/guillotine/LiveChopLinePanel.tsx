import { ChevronDownIcon } from '@radix-ui/react-icons';
import { Fragment, useState } from 'react';
import { Link } from '~/components/ui/link';
import { Section } from '~/components/ui/section';
import { FOCUS_RING } from '~/components/ui/styles';
import { PositionMark } from '~/components/ui/swatch';
import { pts } from '~/libs/guillotine/display';
import type { LiveChopLine } from '~/libs/guillotine/live.server';
import { cn } from '~/utils';

const formatMargin = (margin: number) =>
  `${margin > 0 ? '+' : ''}${margin.toFixed(1)}`;

const STATE_LABEL = {
  complete: 'final',
  in_game: 'playing',
  pre_game: 'yet to play',
  bye: 'no game',
} as const;

/**
 * A week in progress: surviving teams by projected total, with the chop line
 * drawn under the last safe team. Tapping a team opens its starters on a row
 * of their own, so the lineup gets the table's full width on a phone.
 */
export default function LiveChopLinePanel({
  showWeekLink = true,
  week,
  live,
  names,
  leagueId,
}: {
  week: number;
  live: LiveChopLine;
  names: Record<number, string>;
  leagueId: string;
  showWeekLink?: boolean;
}) {
  const [open, setOpen] = useState<Set<number>>(new Set());
  const toggle = (rosterId: number) =>
    setOpen(current => {
      const next = new Set(current);
      if (next.has(rosterId)) next.delete(rosterId);
      else next.add(rosterId);
      return next;
    });

  return (
    <Section
      title={`Week ${week} Chop Line`}
      action={
        showWeekLink && (
          <Link to={`/side-leagues/guillotine/${leagueId}/week/${week}`}>
            Week {week} Scores
          </Link>
        )
      }
    >
      <div className='relative overflow-x-auto'>
        <table className='w-full text-left tabular-nums'>
          <thead>
            <tr className='border-b border-border text-sm text-muted-foreground'>
              <th className='px-2 py-2.5 font-semibold'>Rank</th>
              <th className='px-2 py-2.5 font-semibold'>Team</th>
              <th className='hidden px-2 py-2.5 text-right font-semibold sm:table-cell'>
                Points
              </th>
              <th className='hidden px-2 py-2.5 text-right font-semibold sm:table-cell'>
                Left
              </th>
              <th className='px-2 py-2.5 text-right font-semibold'>
                Projected
              </th>
              <th className='hidden px-2 py-2.5 text-right font-semibold sm:table-cell'>
                Against the Chop
              </th>
            </tr>
          </thead>
          <tbody>
            {live.map((team, index) => {
              // The cut sits between the last safe team and the one on the block,
              // which is the last team with a lineup.
              const blockIndex = live.findIndex(t => t.onTheBlock);
              const aboveTheLine = index === blockIndex - 1;
              const isOpen = open.has(team.rosterId);
              const marginTone = team.onTheBlock
                ? 'text-negative'
                : 'text-positive';
              return (
                <Fragment key={team.rosterId}>
                  <tr
                    onClick={() => toggle(team.rosterId)}
                    className={cn(
                      'cursor-pointer border-b border-border hover:bg-secondary',
                      team.onTheBlock && 'bg-destructive/20',
                      aboveTheLine &&
                        !isOpen &&
                        'border-b-[3px] border-b-destructive',
                    )}
                  >
                    <td className='px-2 py-2.5 text-muted-foreground'>
                      {team.rank}
                    </td>
                    <td className='px-2 py-2.5'>
                      <button
                        type='button'
                        aria-expanded={isOpen}
                        className={cn(
                          'inline-flex items-center gap-1 text-left',
                          FOCUS_RING,
                        )}
                        onClick={e => {
                          e.stopPropagation();
                          toggle(team.rosterId);
                        }}
                      >
                        <ChevronDownIcon
                          aria-hidden
                          className={cn(
                            'size-4 shrink-0 text-muted-foreground transition-transform duration-fast',
                            !isOpen && '-rotate-90',
                          )}
                        />
                        {names[team.rosterId]}
                      </button>
                      {team.onTheBlock && (
                        <div className='font-semibold text-negative'>
                          On the block
                        </div>
                      )}
                      {!team.lineupSet && (
                        <div className='text-sm text-muted-foreground'>
                          No lineup set
                        </div>
                      )}
                      {/* Phones drop the Points and Left columns for these lines. */}
                      <div className='grid text-sm text-muted-foreground sm:hidden'>
                        <span>{pts(team.points)} points</span>
                        <span>{team.playersRemaining} left to play</span>
                      </div>
                    </td>
                    <td className='hidden px-2 py-2.5 text-right sm:table-cell'>
                      {pts(team.points)}
                    </td>
                    <td className='hidden px-2 py-2.5 text-right sm:table-cell'>
                      {team.playersRemaining}
                    </td>
                    <td className='px-2 py-2.5 text-right font-semibold'>
                      {pts(team.projected, 1)}
                      {team.margin !== null && (
                        <div
                          className={cn(
                            'text-sm font-normal sm:hidden',
                            marginTone,
                          )}
                        >
                          {formatMargin(team.margin)}
                        </div>
                      )}
                    </td>
                    <td
                      className={cn(
                        'hidden px-2 py-2.5 text-right sm:table-cell',
                        marginTone,
                      )}
                    >
                      {team.margin === null ? '–' : formatMargin(team.margin)}
                    </td>
                  </tr>
                  {isOpen && (
                    <tr
                      className={cn(
                        'border-b border-border',
                        team.onTheBlock && 'bg-destructive/20',
                        aboveTheLine && 'border-b-[3px] border-b-destructive',
                      )}
                    >
                      <td colSpan={6} className='px-2 pb-3 pl-8'>
                        {team.lineupSet ? (
                          <table className='w-full text-sm'>
                            <thead className='sr-only'>
                              <tr>
                                <th>Position</th>
                                <th>Player</th>
                                <th>Game</th>
                                <th>Points</th>
                                <th>Projected</th>
                              </tr>
                            </thead>
                            <tbody>
                              {team.starters.map((starter, i) => (
                                <tr key={`${starter.sleeperId}-${i}`}>
                                  <td className='w-14 py-0.5'>
                                    <PositionMark
                                      position={starter.position ?? null}
                                    />
                                  </td>
                                  <td className='py-0.5'>{starter.name}</td>
                                  <td className='py-0.5 text-muted-foreground'>
                                    {STATE_LABEL[starter.state]}
                                  </td>
                                  <td className='py-0.5 text-right'>
                                    {pts(starter.points)}
                                  </td>
                                  <td className='py-0.5 text-right text-muted-foreground'>
                                    {pts(starter.projected, 1)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          <p className='text-sm text-muted-foreground'>
                            Sleeper has no lineup for this team this week yet.
                          </p>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </Section>
  );
}
