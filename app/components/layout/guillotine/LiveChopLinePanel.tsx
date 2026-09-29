import { Link } from '@remix-run/react';
import clsx from 'clsx';
import { Fragment, useState } from 'react';
import ProfileSection from '~/components/layout/profile/ProfileSection';
import { pts } from '~/libs/guillotine/display';
import type { LiveChopLine } from '~/libs/guillotine/live.server';

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
    <ProfileSection
      title={`Week ${week} Chop Line`}
      description='Surviving teams ranked by projected total: what each starter has scored, plus the share of their projection still to be played. Tap a team for its lineup.'
      action={
        showWeekLink && (
          <Link
            to={`/games/guillotine/${leagueId}/week/${week}`}
            className='text-sm'
          >
            Full week
          </Link>
        )
      }
    >
      <div className='overflow-x-auto'>
        <table className='w-full text-sm'>
          <thead>
            <tr className='text-left text-slate-400'>
              <th className='py-1 pr-2'>#</th>
              <th className='py-1 pr-2'>Team</th>
              <th className='hidden py-1 pr-2 text-right sm:table-cell'>
                Points
              </th>
              <th className='hidden py-1 pr-2 text-right sm:table-cell'>
                Left
              </th>
              <th className='py-1 pr-2 text-right'>Projected</th>
              <th className='hidden py-1 text-right sm:table-cell'>vs. Chop</th>
            </tr>
          </thead>
          <tbody>
            {live.map((team, index) => {
              // The cut sits between the last safe team and the one on the block,
              // which is the last team with a lineup.
              const blockIndex = live.findIndex(t => t.onTheBlock);
              const aboveTheLine = index === blockIndex - 1;
              const isOpen = open.has(team.rosterId);
              return (
                <Fragment key={team.rosterId}>
                  <tr
                    onClick={() => toggle(team.rosterId)}
                    className={clsx(
                      'cursor-pointer border-t border-slate-700 hover:bg-slate-700/40',
                      team.onTheBlock && 'bg-rose-900/40',
                      aboveTheLine && !isOpen && 'border-b-2 border-b-rose-500',
                    )}
                  >
                    <td className='py-1.5 pr-2 text-slate-400'>{team.rank}</td>
                    <td className='py-1.5 pr-2 text-white'>
                      <button
                        type='button'
                        aria-expanded={isOpen}
                        className='text-left'
                        onClick={e => {
                          e.stopPropagation();
                          toggle(team.rosterId);
                        }}
                      >
                        <span className='mr-1 text-slate-500'>
                          {isOpen ? '▾' : '▸'}
                        </span>
                        {names[team.rosterId]}
                      </button>
                      {!team.lineupSet && (
                        <span className='ml-2 whitespace-nowrap rounded bg-slate-600 px-1.5 py-0.5 text-xs font-semibold'>
                          No lineup set
                        </span>
                      )}
                      {team.onTheBlock && (
                        <span className='ml-2 whitespace-nowrap rounded bg-rose-600 px-1.5 py-0.5 text-xs font-bold uppercase'>
                          On the block
                        </span>
                      )}
                      {/* Phones drop the Points and Left columns for this line. */}
                      <div className='text-xs text-slate-400 sm:hidden'>
                        {pts(team.points)} pts · {team.playersRemaining} left
                      </div>
                    </td>
                    <td className='hidden py-1.5 pr-2 text-right tabular-nums sm:table-cell'>
                      {pts(team.points)}
                    </td>
                    <td className='hidden py-1.5 pr-2 text-right tabular-nums sm:table-cell'>
                      {team.playersRemaining}
                    </td>
                    <td className='py-1.5 pr-2 text-right font-semibold tabular-nums text-white'>
                      {pts(team.projected, 1)}
                      {team.margin !== null && (
                        <div
                          className={clsx(
                            'text-xs font-normal sm:hidden',
                            team.onTheBlock
                              ? 'text-rose-300'
                              : 'text-emerald-300',
                          )}
                        >
                          {formatMargin(team.margin)}
                        </div>
                      )}
                    </td>
                    <td
                      className={clsx(
                        'hidden py-1.5 text-right tabular-nums sm:table-cell',
                        team.onTheBlock ? 'text-rose-300' : 'text-emerald-300',
                      )}
                    >
                      {team.margin === null ? '—' : formatMargin(team.margin)}
                    </td>
                  </tr>
                  {isOpen && (
                    <tr
                      className={clsx(
                        team.onTheBlock && 'bg-rose-900/40',
                        aboveTheLine && 'border-b-2 border-b-rose-500',
                      )}
                    >
                      <td colSpan={6} className='pb-2 pl-6 pr-1'>
                        {team.lineupSet ? (
                          <ul className='m-0 list-none space-y-0.5 p-0 text-xs text-slate-300'>
                            {team.starters.map((starter, i) => (
                              <li
                                key={`${starter.sleeperId}-${i}`}
                                className='flex justify-between gap-3'
                              >
                                <span>
                                  {starter.position && (
                                    <span className='mr-1 text-slate-500'>
                                      {starter.position}
                                    </span>
                                  )}
                                  {starter.name}
                                  <span className='ml-1 text-slate-500'>
                                    {STATE_LABEL[starter.state]}
                                  </span>
                                </span>
                                <span className='whitespace-nowrap tabular-nums'>
                                  {pts(starter.points)} →{' '}
                                  {pts(starter.projected, 1)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className='m-0 text-xs text-slate-400'>
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
    </ProfileSection>
  );
}
