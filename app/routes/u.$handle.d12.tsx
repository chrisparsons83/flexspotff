import type { LoaderFunctionArgs } from '@remix-run/node';
import { Link, useOutletContext } from '@remix-run/react';
import clsx from 'clsx';
import { useState } from 'react';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import CareerCard, { MiniStat } from '~/components/layout/profile/CareerCard';
import ContestEmptyState from '~/components/layout/profile/ContestEmptyState';
import LeadContext from '~/components/layout/profile/LeadContext';
import ProfileSection from '~/components/layout/profile/ProfileSection';
import { Trophies } from '~/components/layout/profile/SeasonFinish';
import { CurrentSeason } from '~/components/layout/profile/StatusText';
import { ordinal, pts, weekLabel } from '~/components/layout/profile/format';
import { TEXT } from '~/components/layout/profile/tones';
import { RangeBar } from '~/components/ui/bars';
import { DraftBoard, DraftBoardCell } from '~/components/ui/draft-board';
import { positionTint } from '~/components/ui/fills';
import { YearFilter } from '~/components/ui/segmented-control';
import { ShowAllButton } from '~/components/ui/show-all-button';
import { PositionMark, Swatch } from '~/components/ui/swatch';
import { Table } from '~/components/ui/table';
import { requireProfileMember } from '~/models/profile/access.server';
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
import type { RouteHandle } from '~/utils/route-handle';

export const handle: RouteHandle = { title: 'D12' };

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const userId = await requireProfileMember(request, params.handle);

  return typedjson({ profile: await getD12Profile(userId) });
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
  const { bestWeek, worstWeek } = career;
  const { bestTeam, worstTeam } = career;

  return (
    <ProfileSection title='Career'>
      <div className='grid gap-3 md:grid-cols-2'>
        <CareerCard
          title='Average week'
          lead={pts(career.averageWeek, 1)}
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
            label='Worst week'
            value={pts(worstWeek?.points)}
            tone='text-negative'
            detail={worstWeek && weekLabel(worstWeek)}
          />
          <MiniStat
            label='Best week'
            value={pts(bestWeek?.points)}
            tone='text-positive'
            detail={bestWeek && weekLabel(bestWeek)}
          />
        </CareerCard>

        <CareerCard
          title='Average team'
          lead={
            <>
              {pts(career.averageTeam, 1)}
              {career.teamsInProgress && <LeadContext>so far</LeadContext>}
            </>
          }
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
            label='Worst team'
            value={pts(worstTeam?.points, 1)}
            tone='text-negative'
            detail={worstTeam && teamDetail(worstTeam)}
          />
          <MiniStat
            label='Best team'
            value={pts(bestTeam?.points, 1)}
            tone='text-positive'
            detail={bestTeam && teamDetail(bestTeam)}
          />
        </CareerCard>

        {/* Finishes only mean something once a season is over, so a member
            in their first season gets the two cards above alone. */}
        {career.completedSeasons > 0 && (
          <CareerCard
            title='Finishes'
            lead={
              career.titles > 0 ? (
                <Trophies titles={career.titles} />
              ) : career.bestFinish ? (
                ordinal(career.bestFinish.rank)
              ) : (
                '–'
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
              tone={career.titles > 0 ? TEXT.champion : undefined}
            />
            <MiniStat label='Top 3' value={career.topThrees} />
            <MiniStat
              label='Average finish'
              value={
                career.averageFinish === null
                  ? '–'
                  : career.averageFinish.toFixed(1)
              }
            />
          </CareerCard>
        )}
      </div>
    </ProfileSection>
  );
}

const teamDetail = (team: TeamSeasonMark) =>
  `${team.year} ${shortD12LeagueName(team.leagueName)}`;

/**
 * The strip down the left of a board cell: starter points ranked against the
 * rest of the board, from dark to light in the blue value sequence, or red for
 * a pick that has never scored. Blue against red rather than green against
 * red, so it reads the same with red-green colour blindness. The cell itself
 * is coloured by position.
 */
const HEAT_BAR: Record<D12Heat, string | undefined> = {
  5: 'bg-sequence-7',
  4: 'bg-sequence-5',
  3: 'bg-sequence-4',
  2: 'bg-sequence-3',
  1: 'bg-sequence-1',
  bust: 'bg-negative',
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
      title='Draft board'
      footnote={<HeatKey />}
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
        renderHeader={column => (
          <div
            className={clsx(
              'flex h-12 flex-col justify-between p-1 text-center',
              column.league ? 'bg-background/70' : 'bg-background/30',
            )}
          >
            <div className='flex justify-center gap-1.5'>
              <span className='font-semibold text-foreground'>
                {column.slot}
              </span>
              {column.league && (
                <span className='text-muted-foreground'>
                  {column.league.shortName}
                </span>
              )}
            </div>
            {column.league ? (
              <div className='tabular-nums text-foreground'>
                {pts(column.teamPoints, 1)}
                <span className='ml-1 text-muted-foreground'>points</span>
              </div>
            ) : (
              <div className='text-muted-foreground'>No picks</div>
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
                  <span className='font-semibold text-foreground'>
                    {pick.position ?? '?'}
                  </span>
                  <span className='text-foreground'>
                    {pick.nflTeam ?? 'FA'}
                  </span>
                </span>
              }
              trailing={
                <span className='font-semibold tabular-nums text-foreground'>
                  {pts(pick.points, 1)}
                </span>
              }
              tone={positionTint(pick.position)}
              indicator={HEAT_BAR[pick.heat]}
              tooltip={`${pick.firstName ?? ''} ${pick.lastName ?? ''}, ${
                pick.pickLabel
              } (#${pick.pickNo}) in ${column.league?.name ?? ''}: ${
                pick.points === null
                  ? 'no lineups yet'
                  : `${pick.points.toFixed(2)} starter points`
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

/** What the strip down each pick's left edge means. */
function HeatKey() {
  return (
    <span className='inline-flex flex-wrap items-center gap-x-4 gap-y-1'>
      <span className='inline-flex items-center gap-1.5'>
        <span aria-hidden='true' className='flex h-3 gap-px'>
          {([1, 2, 3, 4, 5] as const).map(level => (
            <span key={level} className={clsx('w-1', HEAT_BAR[level])} />
          ))}
        </span>
        Starter points, fewest to most on the board
      </span>
      <span className='inline-flex items-center gap-1.5'>
        <span aria-hidden='true' className={clsx('h-3 w-1', HEAT_BAR.bust)} />
        Never scored
      </span>
    </span>
  );
}

const EXPOSURE_PREVIEW = 20;

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
      <Table
        headers={['Player', 'Teams', 'Average pick', 'Range', 'Starter points']}
        primaryColumns={[1, 4]}
        numericColumns={[2, 3, 4]}
      >
        {visible.map(player => (
          <tr key={player.sleeperId} className='border-b border-border'>
            <td className='px-2 py-2 sm:whitespace-nowrap'>
              <span className='inline-flex flex-wrap items-center gap-x-2 gap-y-0.5'>
                <PositionMark position={player.position} />
                <span className='font-medium text-foreground'>
                  {player.firstName} {player.lastName}
                </span>
                <span className='text-sm text-muted-foreground'>
                  {player.nflTeam ?? 'FA'}
                </span>
              </span>
            </td>
            <td className='px-2 py-2'>
              <div className='flex items-center gap-2'>
                <span className='w-12 tabular-nums'>
                  {player.leagues}
                  <span className='text-muted-foreground'>/{teams}</span>
                </span>
                <div
                  aria-hidden='true'
                  className='hidden h-1.5 w-24 overflow-hidden bg-secondary sm:block'
                >
                  <div
                    className='h-full bg-positive/20'
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
            <td className='whitespace-nowrap px-2 py-2 text-right tabular-nums text-muted-foreground'>
              {player.earliestPick === player.latestPick
                ? player.earliestPick
                : `${player.earliestPick}–${player.latestPick}`}
            </td>
            <td className='px-2 py-2 text-right tabular-nums'>
              {pts(player.points, 1)}
            </td>
          </tr>
        ))}
      </Table>
      {players.length > EXPOSURE_PREVIEW && (
        <ShowAllButton
          total={players.length}
          noun='players'
          showAll={showAll}
          onToggle={() => setShowAll(value => !value)}
        />
      )}
    </ProfileSection>
  );
}

function BySeason({ seasons }: { seasons: D12Season[] }) {
  return (
    <ProfileSection title='By season'>
      <Table
        headers={[
          'Year',
          'Finish',
          'Total',
          'Best week',
          'Worst week',
          'Best team',
          'Worst team',
          'Average team',
        ]}
        primaryColumns={[1, 2]}
        numericColumns={[2, 3, 4, 5, 6, 7]}
      >
        {seasons.map(season => (
          <tr key={season.year} className='border-b border-border'>
            <td className='px-2 py-2'>
              <Link to={`/side-leagues/d12/${season.year}`}>{season.year}</Link>
              {season.inProgress && <CurrentSeason />}
            </td>
            <td className='whitespace-nowrap px-2 py-2'>
              {season.finish ? (
                <span
                  className={clsx(
                    'font-medium',
                    season.finish.rank === 1 && !season.inProgress
                      ? TEXT.champion
                      : 'text-foreground',
                  )}
                >
                  {season.finish.rank === 1 && !season.inProgress && (
                    <Swatch fill='medal-gold' className='mr-1.5' />
                  )}
                  {ordinal(season.finish.rank)}
                  <span className='font-normal text-muted-foreground'>
                    {' '}
                    of {season.finish.fieldSize}
                  </span>
                </span>
              ) : (
                '–'
              )}
            </td>
            <td className='px-2 py-2 text-right font-medium tabular-nums'>
              {pts(season.total)}
            </td>
            <WeekCell mark={season.bestWeek} tone='text-positive' />
            <WeekCell mark={season.worstWeek} tone='text-negative' />
            <TeamCell mark={season.bestTeam} tone='text-positive' />
            <TeamCell mark={season.worstTeam} tone='text-negative' />
            <td className='px-2 py-2 text-right tabular-nums'>
              {pts(season.averageTeam, 1)}
            </td>
          </tr>
        ))}
      </Table>
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
          <span className='ml-1.5 text-sm text-muted-foreground'>
            Week {mark.week}
          </span>
        </>
      ) : (
        '–'
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
          <span className='ml-1.5 text-sm text-muted-foreground'>
            {shortD12LeagueName(mark.leagueName)}
          </span>
        </>
      ) : (
        '–'
      )}
    </td>
  );
}
