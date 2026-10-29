import type { LoaderFunctionArgs } from '@remix-run/node';
import { Link, useOutletContext } from '@remix-run/react';
import clsx from 'clsx';
import { useState } from 'react';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import {
  D12DraftBoard,
  D12HeatKey,
} from '~/components/layout/d12/D12DraftBoard';
import CareerCard, { MiniStat } from '~/components/layout/profile/CareerCard';
import ContestEmptyState from '~/components/layout/profile/ContestEmptyState';
import LeadContext from '~/components/layout/profile/LeadContext';
import ProfileSection from '~/components/layout/profile/ProfileSection';
import { Trophies } from '~/components/layout/profile/SeasonFinish';
import { CurrentSeason } from '~/components/layout/profile/StatusText';
import { ordinal, pts, weekLabel } from '~/components/layout/profile/format';
import { TEXT } from '~/components/layout/profile/tones';
import { RangeBar } from '~/components/ui/bars';
import { YearFilter } from '~/components/ui/segmented-control';
import { ShowAllButton } from '~/components/ui/show-all-button';
import { PositionMark, Swatch } from '~/components/ui/swatch';
import { Table } from '~/components/ui/table';
import { requireProfileMember } from '~/models/profile/access.server';
import { getD12Profile } from '~/models/profile/d12.server';
import type {
  D12Board,
  D12Career,
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
          title='Average Week'
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
            label='Worst Week'
            value={pts(worstWeek?.points)}
            tone='text-negative'
            detail={worstWeek && weekLabel(worstWeek)}
          />
          <MiniStat
            label='Best Week'
            value={pts(bestWeek?.points)}
            tone='text-positive'
            detail={bestWeek && weekLabel(bestWeek)}
          />
        </CareerCard>

        <CareerCard
          title='Average Team'
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
            label='Worst Team'
            value={pts(worstTeam?.points, 1)}
            tone='text-negative'
            detail={worstTeam && teamDetail(worstTeam)}
          />
          <MiniStat
            label='Best Team'
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
              label='Average Finish'
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
 * Their drafts from every league at once, a season at a time.
 */
function CombinedDraftBoard({ boards }: { boards: D12Board[] }) {
  const [year, setYear] = useState(boards[0].year);
  const board = boards.find(b => b.year === year) ?? boards[0];

  return (
    <ProfileSection
      title='Draft Board'
      footnote={<D12HeatKey />}
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
      <D12DraftBoard board={board} />
    </ProfileSection>
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
        headers={['Player', 'Teams', 'Average Pick', 'Range', 'Starter Points']}
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
    <ProfileSection title='By Season'>
      <Table
        headers={[
          'Year',
          'Finish',
          'Total',
          'Best Week',
          'Worst Week',
          'Best Team',
          'Worst Team',
          'Average Team',
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
