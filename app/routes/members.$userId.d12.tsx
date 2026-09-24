import type { LoaderFunctionArgs } from '@remix-run/node';
import { Link, useOutletContext } from '@remix-run/react';
import clsx from 'clsx';
import { useState } from 'react';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import DraftBoard, {
  DraftBoardCell,
} from '~/components/layout/draftboard/DraftBoard';
import CareerCard, { MiniStat } from '~/components/layout/profile/CareerCard';
import ContestEmptyState from '~/components/layout/profile/ContestEmptyState';
import ProfileSection from '~/components/layout/profile/ProfileSection';
import ProfileTable from '~/components/layout/profile/ProfileTable';
import RangeBar from '~/components/layout/profile/RangeBar';
import YearFilter from '~/components/layout/profile/YearFilter';
import { requireProfileAccess } from '~/models/profile/access.server';
import { getD12Profile } from '~/models/profile/d12.server';
import type {
  D12Board,
  D12BoardPick,
  D12Career,
  D12Heat,
  D12Season,
  TeamSeasonMark,
} from '~/models/profile/d12Profile';
import {
  buildD12Exposure,
  shortD12LeagueName,
} from '~/models/profile/d12Profile';
import type { ProfileSummary } from '~/models/profile/summary.server';
import { POSITION_RANK_COLORS, POSITION_TINT_COLORS } from '~/utils/constants';

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  await requireProfileAccess(request);

  const { userId } = params;
  if (!userId) throw new Response('Not Found', { status: 404 });

  return typedjson({ profile: await getD12Profile(userId) });
};

const pts = (value: number | null | undefined, digits = 2) =>
  value === null || value === undefined ? '—' : value.toFixed(digits);

const plural = (count: number, noun: string) =>
  `${count} ${noun}${count === 1 ? '' : 's'}`;

const ordinal = (rank: number) => {
  const tens = rank % 100;
  if (tens >= 11 && tens <= 13) return `${rank}th`;
  return `${rank}${['th', 'st', 'nd', 'rd'][rank % 10] ?? 'th'}`;
};

export default function MemberD12() {
  const { profile } = useTypedLoaderData<typeof loader>();
  const summary = useOutletContext<ProfileSummary>();

  if (!profile.hasPlayed) {
    return (
      <ContestEmptyState contest='D12' memberName={summary.user.discordName} />
    );
  }

  return (
    <div className='space-y-8'>
      <Career career={profile.career} />
      <BySeason seasons={profile.seasons} />
      {profile.boards.length > 0 && (
        <>
          <CombinedDraftBoard boards={profile.boards} />
          <Exposure boards={profile.boards} />
        </>
      )}
    </div>
  );
}

function Career({ career }: { career: D12Career }) {
  const { bestWeek, worstWeek, bestTeamWeek, worstTeamWeek } = career;
  const { bestTeam, worstTeam } = career;

  return (
    <ProfileSection title='Career'>
      <div className='grid gap-3 md:grid-cols-2'>
        <CareerCard
          title='Weekly Totals'
          lead={pts(career.averageWeek, 1)}
          leadNote='points a week, every team combined'
          meter={
            bestWeek &&
            worstWeek &&
            career.averageWeek !== null && (
              <RangeBar
                low={worstWeek.points}
                high={bestWeek.points}
                mark={career.averageWeek}
              />
            )
          }
        >
          <MiniStat
            label='Worst Week'
            value={pts(worstWeek?.points)}
            tone='text-rose-300'
            detail={worstWeek && `${worstWeek.year}, Wk ${worstWeek.week}`}
          />
          <MiniStat
            label='Best Week'
            value={pts(bestWeek?.points)}
            tone='text-emerald-300'
            detail={bestWeek && `${bestWeek.year}, Wk ${bestWeek.week}`}
          />
        </CareerCard>

        <CareerCard
          title='Single-Team Weeks'
          lead={pts(career.averageTeamWeek, 1)}
          leadNote='points a week, per team'
          meter={
            bestTeamWeek &&
            worstTeamWeek &&
            career.averageTeamWeek !== null && (
              <RangeBar
                low={worstTeamWeek.points}
                high={bestTeamWeek.points}
                mark={career.averageTeamWeek}
              />
            )
          }
        >
          <MiniStat
            label='Worst'
            value={pts(worstTeamWeek?.points)}
            tone='text-rose-300'
            detail={
              worstTeamWeek &&
              `${shortD12LeagueName(worstTeamWeek.leagueName)}, ${
                worstTeamWeek.year
              } Wk ${worstTeamWeek.week}`
            }
          />
          <MiniStat
            label='Best'
            value={pts(bestTeamWeek?.points)}
            tone='text-emerald-300'
            detail={
              bestTeamWeek &&
              `${shortD12LeagueName(bestTeamWeek.leagueName)}, ${
                bestTeamWeek.year
              } Wk ${bestTeamWeek.week}`
            }
          />
        </CareerCard>

        {/* Both of these only mean something once a season is over, so a
            member in their first season gets the two weekly cards alone. */}
        {career.completedSeasons > 0 && (
          <>
            <CareerCard
              title='Team Seasons'
              lead={pts(career.averageTeam, 1)}
              leadNote='points per team, per finished season'
              meter={
                bestTeam &&
                worstTeam &&
                career.averageTeam !== null && (
                  <RangeBar
                    low={worstTeam.points}
                    high={bestTeam.points}
                    mark={career.averageTeam}
                  />
                )
              }
            >
              <MiniStat
                label='Worst Team'
                value={pts(worstTeam?.points, 1)}
                tone='text-rose-300'
                detail={worstTeam && teamDetail(worstTeam)}
              />
              <MiniStat
                label='Best Team'
                value={pts(bestTeam?.points, 1)}
                tone='text-emerald-300'
                detail={bestTeam && teamDetail(bestTeam)}
              />
            </CareerCard>

            <CareerCard
              title='Finishes'
              lead={
                career.titles > 0 ? (
                  <span className='text-gold'>
                    🏆{career.titles > 1 && ` × ${career.titles}`}
                  </span>
                ) : career.bestFinish ? (
                  ordinal(career.bestFinish.rank)
                ) : (
                  '—'
                )
              }
              leadNote={
                career.current
                  ? `currently ${ordinal(career.current.rank)} of ${
                      career.current.fieldSize
                    } in ${career.current.year}`
                  : career.bestFinish
                  ? `best finish, ${career.bestFinish.year}`
                  : ''
              }
            >
              <MiniStat
                label='Titles'
                value={career.titles}
                tone={career.titles > 0 ? 'text-gold' : undefined}
              />
              <MiniStat label='Top 3' value={career.topThrees} />
              <MiniStat
                label='Avg Finish'
                value={
                  career.averageFinish === null
                    ? '—'
                    : career.averageFinish.toFixed(1)
                }
              />
            </CareerCard>
          </>
        )}
      </div>
    </ProfileSection>
  );
}

const teamDetail = (team: TeamSeasonMark) =>
  `${team.year} · ${shortD12LeagueName(team.leagueName)}`;

/**
 * The strip down the left of a board cell: starter points ranked against
 * the rest of the board, dim to bright green, or red for a pick that has
 * never scored. The cell itself is coloured by position.
 */
const HEAT_BAR: Record<D12Heat, string | undefined> = {
  5: 'bg-green-300',
  4: 'bg-green-400',
  3: 'bg-green-500',
  2: 'bg-green-700',
  1: 'bg-green-900',
  bust: 'bg-red-500',
  none: undefined,
};

const shortName = (pick: D12BoardPick) =>
  pick.firstName && pick.lastName
    ? `${pick.firstName.charAt(0)}. ${pick.lastName}`
    : pick.lastName ?? pick.sleeperId;

/**
 * Their drafts from every league at once. They pick from a different slot in
 * each league, so side by side the drafts fill a whole twelve-team board.
 */
function CombinedDraftBoard({ boards }: { boards: D12Board[] }) {
  const [year, setYear] = useState(boards[0].year);
  const [hovered, setHovered] = useState<string | null>(null);
  const board = boards.find(b => b.year === year) ?? boards[0];

  return (
    <ProfileSection
      title='Draft Board'
      action={
        boards.length > 1 && (
          <YearFilter
            years={boards.map(b => b.year)}
            value={year}
            onChange={value => value !== 'all' && setYear(value)}
            showAll={false}
          />
        )
      }
    >
      <DraftBoard
        columns={board.columns}
        rounds={board.rounds}
        columnKey={column => column.league?.id ?? `slot-${column.slot}`}
        snake
        renderHeader={column => (
          <div
            className={clsx(
              'flex h-12 flex-col justify-between rounded p-1 text-center',
              column.league ? 'bg-slate-900/70' : 'bg-slate-900/30',
            )}
          >
            <div className='flex justify-center gap-1.5'>
              <span className='font-semibold text-white'>{column.slot}</span>
              {column.league && (
                <span className='text-slate-400'>
                  {column.league.shortName}
                </span>
              )}
            </div>
            {column.league ? (
              <div className='tabular-nums text-slate-200'>
                {pts(column.teamPoints, 1)}
                <span className='ml-1 text-slate-500'>pts</span>
              </div>
            ) : (
              <div className='text-slate-500'>No picks</div>
            )}
          </div>
        )}
        renderCell={(column, round) => {
          const pick = column.picks.find(p => p.round === round);
          if (!pick) return null;
          return (
            <DraftBoardCell
              title={shortName(pick)}
              subtitle={
                <span className='flex items-center gap-1'>
                  <span className='font-semibold text-white'>
                    {pick.position ?? '?'}
                  </span>
                  <span className='text-white/70'>{pick.nflTeam ?? 'FA'}</span>
                </span>
              }
              trailing={
                <span className='font-semibold tabular-nums text-white'>
                  {pts(pick.points, 1)}
                </span>
              }
              tone={
                POSITION_TINT_COLORS[pick.position?.toLowerCase() ?? ''] ??
                'bg-slate-700/60'
              }
              indicator={HEAT_BAR[pick.heat]}
              tooltip={`${pick.firstName ?? ''} ${pick.lastName ?? ''} · ${
                pick.pickLabel
              } (#${pick.pickNo}) in ${column.league?.name ?? ''} · ${
                pick.points === null
                  ? 'no lineups yet'
                  : `${pick.points.toFixed(2)} starter pts`
              }`}
              highlighted={hovered === pick.sleeperId}
              dimmed={hovered !== null && hovered !== pick.sleeperId}
              onMouseEnter={() => setHovered(pick.sleeperId)}
              onMouseLeave={() => setHovered(null)}
            />
          );
        }}
      />
    </ProfileSection>
  );
}

const EXPOSURE_PREVIEW = 20;

function PositionChip({ position }: { position: string | null }) {
  return (
    <span
      className={clsx(
        'inline-block w-8 rounded px-1 text-center text-[0.65rem] font-bold text-white',
        POSITION_RANK_COLORS[position?.toLowerCase() ?? ''] ?? 'bg-slate-600',
      )}
    >
      {position ?? '?'}
    </span>
  );
}

/** Who they kept drafting, across all of a season's teams. */
function Exposure({ boards }: { boards: D12Board[] }) {
  const [year, setYear] = useState(boards[0].year);
  const [showAll, setShowAll] = useState(false);
  const board = boards.find(b => b.year === year) ?? boards[0];
  const { teams, players } = buildD12Exposure(board);
  const visible = showAll ? players : players.slice(0, EXPOSURE_PREVIEW);

  return (
    <ProfileSection
      title='Exposure'
      description={`${plural(players.length, 'player')} across ${plural(
        teams,
        'team',
      )}`}
      action={
        boards.length > 1 && (
          <YearFilter
            years={boards.map(b => b.year)}
            value={year}
            onChange={value => value !== 'all' && setYear(value)}
            showAll={false}
          />
        )
      }
    >
      <ProfileTable
        headers={['Player', 'Teams', 'Avg Pick', 'Range', 'Starter Pts']}
        numericColumns={[2, 3, 4]}
      >
        {visible.map(player => (
          <tr key={player.sleeperId} className='border-b border-slate-700/70'>
            <td className='whitespace-nowrap px-2 py-2'>
              <span className='inline-flex items-center gap-2'>
                <PositionChip position={player.position} />
                <span className='font-medium text-slate-100'>
                  {player.firstName} {player.lastName}
                </span>
                <span className='text-xs text-slate-500'>
                  {player.nflTeam ?? 'FA'}
                </span>
              </span>
            </td>
            <td className='px-2 py-2'>
              <div className='flex items-center gap-2'>
                <span className='w-12 tabular-nums'>
                  {player.leagues}
                  <span className='text-slate-500'>/{teams}</span>
                </span>
                <div
                  aria-hidden='true'
                  className='hidden h-1.5 w-24 overflow-hidden rounded-full bg-slate-700 sm:block'
                >
                  <div
                    className='h-full rounded-full bg-emerald-400'
                    style={{
                      width: `${(player.leagues / Math.max(teams, 1)) * 100}%`,
                    }}
                  />
                </div>
              </div>
            </td>
            <td className='px-2 py-2 text-right tabular-nums'>
              {player.averagePick.toFixed(1)}
            </td>
            <td className='whitespace-nowrap px-2 py-2 text-right tabular-nums text-slate-400'>
              {player.earliestPick === player.latestPick
                ? player.earliestPick
                : `${player.earliestPick}–${player.latestPick}`}
            </td>
            <td className='px-2 py-2 text-right tabular-nums'>
              {pts(player.points, 1)}
            </td>
          </tr>
        ))}
      </ProfileTable>
      {players.length > EXPOSURE_PREVIEW && (
        <button
          type='button'
          onClick={() => setShowAll(value => !value)}
          className='mt-3 rounded bg-slate-700 px-3 py-1 text-sm text-slate-300 hover:bg-slate-600'
        >
          {showAll ? 'Show fewer' : `Show all ${players.length} players`}
        </button>
      )}
    </ProfileSection>
  );
}

function BySeason({ seasons }: { seasons: D12Season[] }) {
  return (
    <ProfileSection title='By Season'>
      <ProfileTable
        headers={[
          'Year',
          'Finish',
          'Total',
          'Best Wk',
          'Worst Wk',
          'Best Team',
          'Worst Team',
          'Avg Team',
        ]}
        numericColumns={[2, 3, 4, 5, 6, 7]}
      >
        {seasons.map(season => (
          <tr key={season.year} className='border-b border-slate-700/70'>
            <td className='px-2 py-2'>
              <Link to={`/games/d12/${season.year}`}>{season.year}</Link>
            </td>
            <td className='whitespace-nowrap px-2 py-2'>
              {season.finish ? (
                <span
                  className={clsx(
                    'font-medium',
                    season.finish.rank === 1 && !season.inProgress
                      ? 'text-gold'
                      : 'text-slate-100',
                  )}
                >
                  {season.finish.rank === 1 && !season.inProgress && '🏆 '}
                  {ordinal(season.finish.rank)}
                  <span className='font-normal text-slate-400'>
                    {' '}
                    of {season.finish.fieldSize}
                  </span>
                </span>
              ) : (
                '—'
              )}
              {season.inProgress && (
                <span className='ml-2 rounded bg-amber-400/15 px-1.5 py-0.5 text-xs text-amber-200'>
                  In progress
                </span>
              )}
            </td>
            <td className='px-2 py-2 text-right font-medium tabular-nums'>
              {pts(season.total)}
            </td>
            <WeekCell mark={season.bestWeek} tone='text-emerald-300' />
            <WeekCell mark={season.worstWeek} tone='text-rose-300' />
            <TeamCell mark={season.bestTeam} tone='text-emerald-300' />
            <TeamCell mark={season.worstTeam} tone='text-rose-300' />
            <td className='px-2 py-2 text-right tabular-nums'>
              {pts(season.averageTeam, 1)}
            </td>
          </tr>
        ))}
      </ProfileTable>
    </ProfileSection>
  );
}

function WeekCell({
  mark,
  tone,
}: {
  mark: D12Season['bestWeek'];
  tone: string;
}) {
  return (
    <td className='whitespace-nowrap px-2 py-2 text-right tabular-nums'>
      {mark ? (
        <>
          <span className={tone}>{mark.points.toFixed(2)}</span>
          <span className='ml-1.5 text-xs text-slate-500'>Wk {mark.week}</span>
        </>
      ) : (
        '—'
      )}
    </td>
  );
}

function TeamCell({
  mark,
  tone,
}: {
  mark: TeamSeasonMark | null;
  tone: string;
}) {
  return (
    <td className='whitespace-nowrap px-2 py-2 text-right tabular-nums'>
      {mark ? (
        <>
          <span className={tone}>{mark.points.toFixed(1)}</span>
          <span className='ml-1.5 text-xs text-slate-500'>
            {shortD12LeagueName(mark.leagueName)}
          </span>
        </>
      ) : (
        '—'
      )}
    </td>
  );
}
