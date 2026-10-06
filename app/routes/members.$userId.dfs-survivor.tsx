import { ClockIcon } from '@heroicons/react/solid';
import type { LoaderFunctionArgs } from '@remix-run/node';
import { Link, useOutletContext } from '@remix-run/react';
import clsx from 'clsx';
import type { ReactNode } from 'react';
import { Fragment, useState } from 'react';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import CareerCard, { MiniStat } from '~/components/layout/profile/CareerCard';
import ContestEmptyState from '~/components/layout/profile/ContestEmptyState';
import FinishMeter from '~/components/layout/profile/FinishMeter';
import InfoTip from '~/components/layout/profile/InfoTip';
import LabelledRange from '~/components/layout/profile/LabelledRange';
import LeadContext from '~/components/layout/profile/LeadContext';
import PositionChip from '~/components/layout/profile/PositionChip';
import ProfileSection from '~/components/layout/profile/ProfileSection';
import ProfileTable from '~/components/layout/profile/ProfileTable';
import RangeBar from '~/components/layout/profile/RangeBar';
import SeasonFinish, {
  Trophies,
} from '~/components/layout/profile/SeasonFinish';
import SegmentedControl from '~/components/layout/profile/SegmentedControl';
import ShowAllButton from '~/components/layout/profile/ShowAllButton';
import Tag, { CurrentTag } from '~/components/layout/profile/Tag';
import WeekGrid, {
  LegendItem,
  ScaleKey,
  Swatch,
  WEEK_SCALE,
  WeekLegend,
  WonKey,
  rankTone,
} from '~/components/layout/profile/WeekGrid';
import type { WeekGridCell } from '~/components/layout/profile/WeekGrid';
import YearFilter from '~/components/layout/profile/YearFilter';
import {
  CHART,
  ChartKey,
  ChartKeys,
  FieldBandKeys,
  useChartWidth,
  weekLabelStep,
} from '~/components/layout/profile/chart';
import {
  ordinal,
  plural,
  pts,
  signed as signedBy,
  weekLabel,
} from '~/components/layout/profile/format';
import { signedTone, TEXT } from '~/components/layout/profile/tones';
import type { DfsSurvivorSlot } from '~/libs/dfs-survivor/slots';
import {
  DFS_SURVIVOR_LAST_WEEK,
  formatSlotName,
} from '~/libs/dfs-survivor/slots';
import { requireProfileAccess } from '~/models/profile/access.server';
import { getDfsSurvivorProfile } from '~/models/profile/dfsSurvivor.server';
import type {
  DfsCareer,
  DfsFieldWeek,
  DfsPick,
  DfsPoolSeason,
  DfsPositionRow,
  DfsSeason,
  DfsWeek,
  SlotGroup,
  StageSplit,
} from '~/models/profile/dfsSurvivorProfile';
import {
  BIG_PICK,
  STAGES,
  STAR_PICKS,
} from '~/models/profile/dfsSurvivorProfile';
import type { ProfileSummary } from '~/models/profile/summary.server';

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  await requireProfileAccess(request);

  const { userId } = params;
  if (!userId) throw new Response('Not Found', { status: 404 });

  return typedjson({ profile: await getDfsSurvivorProfile(userId) });
};

/** Points to two places unless asked otherwise, signed. */
const signed = (value: number, digits = 2) => signedBy(value, digits);

const GROUP_LABEL: Record<SlotGroup, string> = {
  QB: 'QB',
  RB: 'RB',
  WR: 'WR',
  TE: 'TE',
  FLEX: 'FLEX',
  K: 'K',
  DEF: 'D/ST',
};

export default function MemberDfsSurvivor() {
  const { profile } = useTypedLoaderData<typeof loader>();
  const summary = useOutletContext<ProfileSummary>();

  if (!profile.hasPlayed) {
    return (
      <ContestEmptyState
        contest='DFS Survivor'
        memberName={summary.user.discordName}
      />
    );
  }

  return (
    <div className='space-y-8'>
      <Career career={profile.career} seasons={profile.seasons} />
      <BySeason seasons={profile.seasons} />
      <WeekByWeek seasons={profile.seasons} />
      <WeeklyScores seasons={profile.seasons} />
      <PoolManagement pool={profile.pool} />
      <TimingByPlayer seasons={profile.seasons} />
      <ByPosition positions={profile.positions} />
      <LineupLog seasons={profile.seasons} />
    </div>
  );
}

function Career({
  career,
  seasons,
}: {
  career: DfsCareer;
  seasons: DfsSeason[];
}) {
  const { bestWeek, worstWeek, aboveAverage } = career;

  return (
    <ProfileSection title='Career'>
      <div className='grid gap-3 md:grid-cols-3'>
        <CareerCard
          title='Weekly Lineup'
          lead={
            <>
              {pts(career.averageWeek)}
              {career.vsField !== null && (
                <LeadContext>
                  <span className={signedTone(career.vsField)}>
                    {signed(career.vsField)}
                  </span>{' '}
                  vs average
                </LeadContext>
              )}
            </>
          }
          meter={
            bestWeek &&
            worstWeek &&
            career.averageWeek !== null && (
              <LabelledRange
                low={worstWeek.total}
                high={bestWeek.total}
                mark={career.averageWeek}
                lowLabel={weekLabel(worstWeek)}
                highLabel={weekLabel(bestWeek)}
                format={value => value.toFixed(2)}
              />
            )
          }
        >
          <RateStat
            label='Weeks Won'
            count={career.weeklyWins}
            of={career.weeks}
            hint={`${career.weeklyWins} of ${plural(
              career.weeks,
              'week',
            )} with the top lineup of everyone who played`}
            tone={career.weeklyWins > 0 ? TEXT.champion : undefined}
          />
          <RateStat
            label='Above Average'
            count={aboveAverage}
            of={career.weeks}
            info={
              <>
                Weeks their lineup scored more than the average lineup that week
                - the mean of every lineup set, not the top score.{' '}
                {aboveAverage} of {plural(career.weeks, 'week')}.
              </>
            }
          />
        </CareerCard>

        <TimingCard career={career} />
        <FinishesCard career={career} seasons={seasons} />
      </div>
    </ProfileSection>
  );
}

/**
 * Each player can only be spent once, and most members end up spending the
 * same good ones, so the skill is in the week you pick. This is that, measured
 * against the other members who used the same player.
 */
function TimingCard({ career }: { career: DfsCareer }) {
  const { timing } = career;
  const { ahead, behind, compared } = timing;

  return (
    <CareerCard
      title={
        <span className='inline-flex items-center gap-1.5'>
          Timing Edge
          <InfoTip label='About Timing Edge'>
            Each player can only be used once a season, so what matters is the
            week you use him. Every pick is compared with the other members who
            used the same player in a different week. A positive number means
            they got more out of their players, on average, than those members
            did.
          </InfoTip>
        </span>
      }
      lead={
        timing.edge === null ? (
          '—'
        ) : (
          <>
            <span className={signedTone(timing.edge)}>
              {signed(timing.edge)}
            </span>
            <LeadContext>points a pick</LeadContext>
          </>
        )
      }
      meter={
        compared > 0 && (
          <>
            <div
              aria-hidden='true'
              className='flex h-2 gap-0.5 overflow-hidden rounded-full bg-slate-700'
            >
              <div
                className='bg-emerald-400'
                style={{ width: `${(ahead / compared) * 100}%` }}
              />
              <div
                className='bg-rose-400'
                style={{ width: `${(behind / compared) * 100}%` }}
              />
            </div>
            <div className='mt-2 flex justify-between gap-2 text-xs text-slate-400'>
              <span>
                <span className='font-semibold tabular-nums text-emerald-300'>
                  {ahead}
                </span>{' '}
                picks ahead
              </span>
              <span>
                <span className='font-semibold tabular-nums text-rose-300'>
                  {behind}
                </span>{' '}
                behind
              </span>
            </div>
          </>
        )
      }
    >
      <RateStat
        label='Best Timing'
        count={timing.bestTimingPicks}
        of={timing.compared}
        info={
          <>
            How often they caught a player on his best week of everyone who used
            him: nobody who used the same player that season got more points
            from him. {timing.bestTimingPicks} of the{' '}
            {plural(timing.compared, 'pick')} someone else also made.
          </>
        }
      />
      <MiniStat
        label='Late Season'
        value={
          timing.lateVsField === null ? (
            '—'
          ) : (
            <span className={signedTone(timing.lateVsField)}>
              {signed(timing.lateVsField, 1)}
            </span>
          )
        }
        info={
          timing.lateWeeks > 0 ? (
            <>
              Their lineup in weeks 13–17 against the average lineup those
              weeks. The pool is thinnest at the end of the season, so this
              shows who held something back. Over{' '}
              {plural(timing.lateWeeks, 'week')}.
            </>
          ) : (
            'Their lineup in weeks 13–17 against the average lineup those weeks. They have not played that late in a season yet.'
          )
        }
      />
    </CareerCard>
  );
}

/** A share as the headline. The count it came from is in the explanation. */
function RateStat({
  label,
  count,
  of,
  hint,
  info,
  tone,
}: {
  label: string;
  count: number;
  of: number;
  hint?: string;
  info?: ReactNode;
  tone?: string;
}) {
  return (
    <MiniStat
      label={label}
      value={of > 0 ? `${Math.round((count / of) * 100)}%` : '—'}
      hint={hint}
      info={info}
      tone={tone}
    />
  );
}

/** How their seasons have ended, as counts rather than a list of years. */
function FinishesCard({
  career,
  seasons,
}: {
  career: DfsCareer;
  seasons: DfsSeason[];
}) {
  const finished = seasons.flatMap(season =>
    season.finish && !season.inProgress ? [season.finish.rank] : [],
  );

  // A member still in their first season has no finishes yet; show where
  // they stand instead.
  if (finished.length === 0) {
    return career.current ? (
      <CareerCard
        title='Standing'
        lead={
          <>
            {ordinal(career.current.rank)}
            <LeadContext>
              of {career.current.fieldSize} in {career.current.year}
            </LeadContext>
          </>
        }
      >
        <MiniStat label='Weeks Played' value={career.weeks} />
      </CareerCard>
    ) : null;
  }

  return (
    <CareerCard
      title='Finishes'
      lead={
        career.titles > 0 ? (
          <>
            <Trophies titles={career.titles} />
            <LeadContext>{plural(career.titles, 'title')}</LeadContext>
          </>
        ) : (
          <>
            {ordinal(career.bestFinish!.rank)}
            <LeadContext>{career.bestFinish!.year}</LeadContext>
          </>
        )
      }
      meter={<FinishMeter ranks={finished} />}
    >
      <MiniStat
        label='Average Finish'
        value={ordinal(Math.round(career.averageFinish!))}
        hint={`${career.averageFinish!.toFixed(1)} across ${plural(
          finished.length,
          'finished season',
        )}`}
      />
      <MiniStat
        label='Top 3'
        value={`${career.topThrees}/${career.completedSeasons}`}
        hint='Finished seasons in the top three'
      />
    </CareerCard>
  );
}

function BySeason({ seasons }: { seasons: DfsSeason[] }) {
  return (
    <ProfileSection title='By Season'>
      <ProfileTable
        headers={[
          'Year',
          'Finish',
          'Total',
          'Weeks',
          'Average Week',
          'vs Average',
          'Best Week',
          'Weeks Won',
          'Players Used',
        ]}
        numericColumns={[2, 3, 4, 5, 6, 7, 8]}
      >
        {seasons.map(season => {
          const { vsField } = season;
          return (
            <tr key={season.year} className='border-b border-slate-700/70'>
              <td className='px-2 py-2'>
                <Link to={`/games/dfs-survivor/standings/${season.year}`}>
                  {season.year}
                </Link>
                {season.inProgress && <CurrentTag />}
              </td>
              <td className='whitespace-nowrap px-2 py-2'>
                <SeasonFinish
                  finish={season.finish}
                  champion={season.finish?.rank === 1 && !season.inProgress}
                />
              </td>
              <td className='whitespace-nowrap px-2 py-2 text-right font-medium tabular-nums'>
                {pts(season.total)}
              </td>
              <td className='whitespace-nowrap px-2 py-2 text-right tabular-nums'>
                {season.weeks.length}
                <span className='text-slate-400'>
                  {' '}
                  / {season.weeksAvailable}
                </span>
              </td>
              <td className='whitespace-nowrap px-2 py-2 text-right tabular-nums'>
                {pts(season.averageWeek)}
              </td>
              <td
                className={clsx(
                  'px-2 py-2 text-right tabular-nums',
                  signedTone(vsField),
                )}
                title={
                  vsField === null
                    ? undefined
                    : `${signed(vsField)} a week against the average lineup`
                }
              >
                {vsField === null ? '—' : signed(vsField)}
              </td>
              <td className='whitespace-nowrap px-2 py-2 text-right tabular-nums'>
                {season.bestWeek ? (
                  <>
                    <span className='text-emerald-300'>
                      {season.bestWeek.total.toFixed(2)}
                    </span>
                    <span className='ml-1.5 text-xs text-slate-400'>
                      Week {season.bestWeek.week}
                    </span>
                  </>
                ) : (
                  '—'
                )}
              </td>
              <td
                className={clsx(
                  'px-2 py-2 text-right tabular-nums',
                  season.weeklyWins > 0 ? TEXT.champion : 'text-slate-400',
                )}
              >
                {season.weeklyWins}
              </td>
              <td className='px-2 py-2 text-right tabular-nums text-slate-300'>
                {season.playersUsed}
              </td>
            </tr>
          );
        })}
      </ProfileTable>
    </ProfileSection>
  );
}

const describeWeek = (week: DfsWeek) =>
  `${weekLabel(week)}: ${week.total.toFixed(2)} points, ${ordinal(
    week.rank,
  )} of ${week.fieldSize}${week.rank === 1 ? ', won the week' : ''}${
    week.emptySlots > 0 ? `. ${plural(week.emptySlots, 'empty slot')}` : ''
  }`;

/** A dashed square for a week they could have played and did not. */
const NO_LINEUP_TONE = 'border border-dashed border-slate-500 text-slate-400';

/** Every season as a strip of weeks, so a career's hot and cold runs show. */
function WeekByWeek({ seasons }: { seasons: DfsSeason[] }) {
  return (
    <ProfileSection
      title='Week by Week'
      description='Each week shaded by where it ranked among everyone who set a lineup.'
    >
      <WeekGrid
        lastWeek={DFS_SURVIVOR_LAST_WEEK}
        minColumn='3.25rem'
        rows={seasons.map(season => {
          const weeks = new Map<number, WeekGridCell>();
          // Scored without them is a week skipped; not scored yet is simply
          // still to come, and left blank.
          for (const number of season.scoredWeeks) {
            weeks.set(number, {
              value: '–',
              title: `${weekLabel({
                year: season.year,
                week: number,
              })}: no lineup`,
              tone: NO_LINEUP_TONE,
            });
          }
          for (const week of season.weeks) {
            weeks.set(week.week, {
              value: week.total.toFixed(1),
              title: describeWeek(week),
              tone: rankTone(week.rank, week.fieldSize),
              won: week.rank === 1,
              marker: week.emptySlots > 0 && <PartialMark />,
            });
          }
          return { year: season.year, weeks };
        })}
      />
      <WeekLegend>
        <WonKey sample='140' />
        <ScaleKey />
        <LegendItem
          swatch={
            <Swatch tone={WEEK_SCALE[2].tone}>
              <PartialMark />
            </Swatch>
          }
        >
          Empty slots
        </LegendItem>
        <LegendItem swatch={<Swatch tone={NO_LINEUP_TONE} />}>
          No lineup
        </LegendItem>
      </WeekLegend>
    </ProfileSection>
  );
}

/** A corner notch for a lineup with empty slots. */
function PartialMark() {
  return (
    <span
      aria-hidden='true'
      className='absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-amber-300 ring-1 ring-slate-900'
    />
  );
}

const CHART_LEFT = 40;

/** The smallest round step that keeps the gridlines to six or fewer. */
function gridStep(ceiling: number) {
  return [10, 20, 25, 50, 100].find(step => ceiling / step <= 6) ?? 200;
}

/**
 * Their lineup each week over the field's: the middle half as a band, the
 * whole spread fainter behind it, and the median dashed. The heatmap above
 * says where a week ranked; this shows by how much, and how the whole field
 * sinks as the pool runs dry. A week they skipped is a gap in the line.
 */
function WeeklyScores({ seasons }: { seasons: DfsSeason[] }) {
  const years = seasons.map(season => season.year);
  const [year, setYear] = useState<number | 'all'>(years[0]);
  const season = seasons.find(entry => entry.year === year) ?? seasons[0];
  const [chartRef, width] = useChartWidth<HTMLDivElement>();

  const lastWeek = DFS_SURVIVOR_LAST_WEEK;
  const { field, weeks } = season;
  const highest = Math.max(
    ...weeks.map(week => week.total),
    ...field.map(point => point.high),
    1,
  );
  // A lineup can finish below zero - a lone defense that gave up a lot - and
  // the axis has to reach it rather than draw it over the week labels.
  const lowest = Math.min(
    ...weeks.map(week => week.total),
    ...field.map(point => point.low),
    0,
  );
  const step = gridStep(highest - lowest);
  const ceiling = Math.ceil(highest / step) * step;
  const floor = Math.floor(lowest / step) * step;

  const plotWidth = width - CHART_LEFT - CHART.right;
  const plotHeight = CHART.height - CHART.top - CHART.bottom;
  const x = (week: number) =>
    CHART_LEFT + ((week - 1) / (lastWeek - 1)) * plotWidth;
  const y = (value: number) =>
    CHART.top + (1 - (value - floor) / (ceiling - floor)) * plotHeight;

  const area = (
    upper: (point: DfsFieldWeek) => number,
    lower: (point: DfsFieldWeek) => number,
  ) =>
    [
      ...field.map(point => `${x(point.week)},${y(upper(point))}`),
      ...[...field]
        .reverse()
        .map(point => `${x(point.week)},${y(lower(point))}`),
    ].join(' ');

  // One line per run of consecutive weeks, so a skipped week breaks it.
  const runs: DfsWeek[][] = [];
  for (const week of weeks) {
    const run = runs[runs.length - 1];
    if (run && run[run.length - 1].week === week.week - 1) run.push(week);
    else runs.push([week]);
  }

  const gridlines = Array.from(
    { length: (ceiling - floor) / step + 1 },
    (_, index) => floor + index * step,
  );
  const weekStep = weekLabelStep(plotWidth, lastWeek);

  return (
    <ProfileSection
      title='Weekly Scores'
      action={
        years.length > 1 ? (
          <YearFilter
            years={years}
            value={season.year}
            onChange={setYear}
            showAll={false}
          />
        ) : undefined
      }
      footnote={
        <ChartKeys>
          <ChartKey>
            <span className='inline-block h-0.5 w-4 rounded bg-sky-400' />
            Their lineup
          </ChartKey>
          <ChartKey>
            <span className='inline-block h-2 w-2 rounded-full bg-gold' />
            Week won
          </ChartKey>
          <FieldBandKeys rangeLabel='Lowest to highest' />
        </ChartKeys>
      }
    >
      <div ref={chartRef}>
        <svg
          width={width}
          height={CHART.height}
          viewBox={`0 0 ${width} ${CHART.height}`}
          className='block'
          role='img'
          aria-label={`Their lineup each week of ${season.year}, against the rest of the field`}
        >
          {gridlines.map(value => (
            <g key={value}>
              <line
                x1={CHART_LEFT}
                x2={width - CHART.right}
                y1={y(value)}
                y2={y(value)}
                className={
                  value === 0 ? 'stroke-slate-400' : 'stroke-slate-700'
                }
                strokeWidth={1}
              />
              <text
                x={CHART_LEFT - 6}
                y={y(value)}
                textAnchor='end'
                dominantBaseline='middle'
                className='fill-slate-500 text-[11px] tabular-nums'
              >
                {value}
              </text>
            </g>
          ))}
          {Array.from({ length: lastWeek }, (_, index) => index + 1)
            .filter(week => (week - 1) % weekStep === 0)
            .map(week => (
              <text
                key={week}
                x={x(week)}
                y={CHART.height - 8}
                textAnchor='middle'
                className='fill-slate-500 text-[11px] tabular-nums'
              >
                {week}
              </text>
            ))}

          <polygon
            points={area(
              point => point.high,
              point => point.low,
            )}
            className='fill-slate-400/10'
          />
          <polygon
            points={area(
              point => point.q3,
              point => point.q1,
            )}
            className='fill-slate-400/25'
          />
          <polyline
            points={field
              .map(point => `${x(point.week)},${y(point.median)}`)
              .join(' ')}
            fill='none'
            className='stroke-slate-300'
            strokeWidth={1.25}
            strokeDasharray='4 4'
          />
          {runs.map(run => (
            <polyline
              key={run[0].week}
              points={run
                .map(week => `${x(week.week)},${y(week.total)}`)
                .join(' ')}
              fill='none'
              className='stroke-sky-400'
              strokeWidth={2.5}
              strokeLinejoin='round'
            />
          ))}
          {weeks.map(week => (
            <circle
              key={week.week}
              cx={x(week.week)}
              cy={y(week.total)}
              r={week.rank === 1 ? 4.5 : 3.5}
              className={clsx(
                'stroke-slate-900',
                week.rank === 1 ? 'fill-gold' : 'fill-sky-400',
              )}
              strokeWidth={2}
            >
              {/* One string: a <title> with several children breaks hydration. */}
              <title>{describeWeek(week)}</title>
            </circle>
          ))}
        </svg>
      </div>
    </ProfileSection>
  );
}

/** A stage's average with how far it sat from the field's, field on hover. */
function StageCell({
  split,
  digits = 2,
}: {
  split: StageSplit;
  digits?: number;
}) {
  if (split.mine === null) {
    return <td className='px-2 py-2 text-right text-slate-400'>—</td>;
  }
  const diff = split.field === null ? null : split.mine - split.field;

  return (
    <td
      className='whitespace-nowrap px-2 py-2 text-right tabular-nums'
      title={
        split.field === null
          ? undefined
          : `Field ${split.field.toFixed(digits)}`
      }
    >
      {split.mine.toFixed(digits)}
      {diff !== null && (
        <span className={clsx('ml-1.5 text-xs', signedTone(diff))}>
          {signed(diff, 1)}
        </span>
      )}
    </td>
  );
}

/**
 * The pool shrinks every week - two QBs a week for seventeen weeks is more
 * starters than the league has - so the late weeks are where a season is won
 * or lost. This is how their points held up as it ran dry, and when they spent
 * their biggest weeks.
 */
function PoolManagement({ pool }: { pool: DfsPoolSeason[] }) {
  const years = pool.map(season => season.year);
  const [year, setYear] = useState<number | 'all'>(years[0]);
  const season = pool.find(entry => entry.year === year) ?? pool[0];

  return (
    <ProfileSection
      title='Pool Management'
      description='Each player can be used once a season, so the pool thins as it goes on.'
      action={
        years.length > 1 ? (
          <YearFilter
            years={years}
            value={season.year}
            onChange={setYear}
            showAll={false}
          />
        ) : undefined
      }
      footnote='Each figure is their average, with how far it sat from the field’s in the same weeks. Hover a cell for the field’s.'
    >
      <ProfileTable
        headers={['', ...STAGES.map(stage => stage.label)]}
        numericColumns={STAGES.map((_, index) => index + 1)}
      >
        <tr className='border-b border-slate-600 font-medium'>
          <td className='px-2 py-2 text-slate-100'>Lineup</td>
          {season.lineup.map(split => (
            <StageCell key={split.stage} split={split} />
          ))}
        </tr>
        {season.groups.map(({ group, stages }) => (
          <tr key={group} className='border-b border-slate-700/70'>
            <td className='px-2 py-2 text-slate-300'>
              {GROUP_LABEL[group]}
              <span className='ml-1 text-xs text-slate-400'>per pick</span>
            </td>
            {stages.map(split => (
              <StageCell key={split.stage} split={split} />
            ))}
          </tr>
        ))}
      </ProfileTable>

      <StarTimeline season={season} />
    </ProfileSection>
  );
}

/** Their best picks of the season, placed in the week they used them. */
function StarTimeline({ season }: { season: DfsPoolSeason }) {
  if (season.stars.length === 0) return null;

  const byWeek = new Map<number, DfsPick[]>();
  for (const pick of season.stars) {
    byWeek.set(pick.week, [...(byWeek.get(pick.week) ?? []), pick]);
  }
  const weekNumbers = Array.from(
    { length: DFS_SURVIVOR_LAST_WEEK },
    (_, i) => i + 1,
  );
  const { starAverageWeek: mine, fieldStarAverageWeek: field } = season;

  return (
    <div className='mt-6'>
      <div className='mb-2 flex flex-wrap items-baseline justify-between gap-2'>
        <h4 className='m-0 text-sm font-semibold text-white'>
          When their best {STAR_PICKS} picks came
        </h4>
        {mine !== null && (
          <p className='m-0 text-xs text-slate-400'>
            Average week{' '}
            <span className='font-semibold tabular-nums text-slate-100'>
              {mine.toFixed(1)}
            </span>
            {field !== null && (
              <>
                {' '}
                · the field&rsquo;s{' '}
                <span className='font-semibold tabular-nums text-slate-100'>
                  {field.toFixed(1)}
                </span>
              </>
            )}
          </p>
        )}
      </div>
      <div className='overflow-x-auto'>
        <div
          className='grid gap-1 text-xs'
          style={{
            gridTemplateColumns: `repeat(${DFS_SURVIVOR_LAST_WEEK}, minmax(4.5rem, 1fr))`,
          }}
        >
          {weekNumbers.map(week => (
            <div
              key={week}
              className='border-b border-slate-700 pb-1 text-center text-slate-400'
            >
              {week}
            </div>
          ))}
          {weekNumbers.map(week => (
            <div key={week} className='space-y-1 pt-1'>
              {(byWeek.get(week) ?? []).map(pick => (
                <div
                  key={pick.playerId}
                  title={`${pick.name}, ${pick.points.toFixed(2)} in week ${
                    pick.week
                  }`}
                  className='rounded bg-slate-900/60 px-1.5 py-1 leading-tight'
                >
                  <div className='truncate text-slate-100'>
                    {pick.shortName}
                  </div>
                  <div className='font-semibold tabular-nums text-emerald-300'>
                    {pick.points.toFixed(1)}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const TIMING_PREVIEW = 15;

/**
 * Every player they spent, against the other members who spent him in a
 * different week. This is the game's real skill: the field shares most of
 * its players, and what tells members apart is when they used them. A player
 * nobody else used has nothing to compare, so he is left out.
 */
function TimingByPlayer({ seasons }: { seasons: DfsSeason[] }) {
  const years = seasons.map(season => season.year);
  const [year, setYear] = useState<number | 'all'>(years[0]);
  const [order, setOrder] = useState<'best' | 'worst'>('best');
  const [showAll, setShowAll] = useState(false);

  const picks = seasons
    .filter(season => year === 'all' || season.year === year)
    .flatMap(season => season.weeks.flatMap(week => week.picks));
  const compared = picks
    .filter(pick => pick.vsOthers !== null)
    .sort((a, b) =>
      order === 'best' ? b.vsOthers! - a.vsOthers! : a.vsOthers! - b.vsOthers!,
    );
  const visible = showAll ? compared : compared.slice(0, TIMING_PREVIEW);

  return (
    <ProfileSection
      title='Timing by Player'
      action={
        <div className='flex flex-wrap gap-3'>
          <SegmentedControl
            label='Order'
            value={order}
            onChange={setOrder}
            options={[
              { value: 'best', label: 'Best calls' },
              { value: 'worst', label: 'Worst calls' },
            ]}
          />
          <YearFilter years={years} value={year} onChange={setYear} />
        </div>
      }
    >
      {compared.length === 0 ? (
        <p className='m-0 text-sm text-slate-400'>
          Nobody else has used any of their players yet.
        </p>
      ) : (
        <ProfileTable
          headers={[
            'Player',
            'Week',
            'Points',
            'Others',
            'Others’ Average',
            'vs Others',
            'Range',
          ]}
          numericColumns={[2, 3, 4, 5]}
        >
          {visible.map(pick => (
            <tr
              key={`${pick.year}-${pick.playerId}`}
              className='border-b border-slate-700/70'
            >
              <td className='whitespace-nowrap px-2 py-2'>
                <PositionChip position={pick.position} />
                <span className='ml-2 font-medium text-slate-100'>
                  {pick.name}
                </span>
                {pick.bestTiming && (
                  <span className='ml-1.5'>
                    <InfoTip
                      label='Best timing'
                      icon={
                        <ClockIcon aria-hidden='true' className='h-4 w-4' />
                      }
                      iconClassName='text-emerald-300 hover:text-emerald-200'
                    >
                      Best timing: nobody who used {pick.name} that season got
                      more points from him.
                    </InfoTip>
                  </span>
                )}
              </td>
              <td className='whitespace-nowrap px-2 py-2 text-slate-300'>
                {year === 'all' && `${pick.year} `}Week {pick.week}
              </td>
              <td className='px-2 py-2 text-right font-medium tabular-nums'>
                {pick.points.toFixed(2)}
              </td>
              <td className='px-2 py-2 text-right tabular-nums text-slate-400'>
                {pick.others.count}
              </td>
              <td className='px-2 py-2 text-right tabular-nums text-slate-300'>
                {pts(pick.others.average)}
              </td>
              <td
                className={clsx(
                  'px-2 py-2 text-right font-medium tabular-nums',
                  signedTone(pick.vsOthers),
                )}
              >
                {signed(pick.vsOthers!)}
              </td>
              <td className='px-2 py-2'>
                <div
                  className='flex items-center gap-2 text-xs tabular-nums text-slate-400'
                  title={`Everyone who used him: ${pick.others.worst.toFixed(
                    2,
                  )} to ${pick.others.best.toFixed(2)}`}
                >
                  <span className='w-8 text-right'>
                    {pick.others.worst.toFixed(1)}
                  </span>
                  <div className='w-20'>
                    <RangeBar
                      low={pick.others.worst}
                      high={pick.others.best}
                      mark={pick.points}
                    />
                  </div>
                  <span className='w-8'>{pick.others.best.toFixed(1)}</span>
                </div>
              </td>
            </tr>
          ))}
        </ProfileTable>
      )}
      {compared.length > TIMING_PREVIEW && (
        <ShowAllButton
          total={compared.length}
          noun='picks'
          showAll={showAll}
          onToggle={() => setShowAll(value => !value)}
        />
      )}
    </ProfileSection>
  );
}

const FLEX_TONES = { RB: 'bg-rb', WR: 'bg-wr', TE: 'bg-te' } as const;

/**
 * Where their points come from, slot by slot, against the field's picks. On a
 * wide screen the FLEX takes the right-hand column two cards tall, with room
 * to say what filled it, and the six fixed slots sit in a 3×2 block beside it.
 */
function ByPosition({ positions }: { positions: DfsPositionRow[] }) {
  return (
    <ProfileSection
      title='By Position'
      description='Their average pick in each slot, against the field’s in the weeks they played.'
    >
      <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
        {positions
          .filter(row => row.picks > 0)
          .map(row => (
            <PositionCard key={row.group} row={row} />
          ))}
      </div>
    </ProfileSection>
  );
}

function PositionCard({ row }: { row: DfsPositionRow }) {
  const diff =
    row.average !== null && row.fieldAverage !== null
      ? row.average - row.fieldAverage
      : null;
  const isFlex = row.group === 'FLEX';

  return (
    <CareerCard
      className={clsx(isFlex && 'lg:col-start-4 lg:row-span-2 lg:row-start-1')}
      title={
        <span className='inline-flex items-center gap-2'>
          <PositionChip position={row.group} />
          {GROUP_LABEL[row.group]}
        </span>
      }
      lead={pts(row.average)}
      leadNote={
        diff === null ? undefined : (
          <>
            <span className={clsx('tabular-nums', signedTone(diff))}>
              {signed(diff)}
            </span>{' '}
            vs the field
          </>
        )
      }
      meter={isFlex && <FlexFills row={row} />}
    >
      <MiniStat
        label='Best'
        value={row.best ? row.best.points.toFixed(1) : '—'}
        detail={row.best?.shortName}
        hint={row.best ? `${row.best.name}, ${weekLabel(row.best)}` : undefined}
        tone={row.best && row.best.points >= BIG_PICK ? TEXT.good : undefined}
      />
      <LowestStat row={row} />
    </CareerCard>
  );
}

/**
 * What filled the FLEX: the split as a bar, then each position with how many
 * times it was used there and what it averaged. The chips double as the bar's
 * key, since they share its colours.
 */
function FlexFills({ row }: { row: DfsPositionRow }) {
  return (
    <>
      <div
        aria-hidden='true'
        className='flex h-2 gap-0.5 overflow-hidden rounded-full bg-slate-700'
      >
        {row.flex
          .filter(fill => fill.picks > 0)
          .map(fill => (
            <div
              key={fill.position}
              className={FLEX_TONES[fill.position]}
              style={{ width: `${(fill.picks / row.picks) * 100}%` }}
            />
          ))}
      </div>
      <ul className='m-0 mt-4 list-none space-y-2.5 p-0'>
        {row.flex.map(fill => (
          <li key={fill.position} className='flex items-center gap-2 text-sm'>
            <PositionChip position={fill.position} />
            <span className='text-slate-300'>{plural(fill.picks, 'pick')}</span>
            <span className='ml-auto font-semibold tabular-nums text-slate-100'>
              {pts(fill.average)}
            </span>
            <span className='text-xs text-slate-400'>average</span>
          </li>
        ))}
      </ul>
    </>
  );
}

/**
 * Their worst week in the slot. A slot left empty scored nothing, so it is
 * the lowest unless a pick went below zero, as a defense can.
 */
function LowestStat({ row }: { row: DfsPositionRow }) {
  const { worst } = row;
  const empty = row.emptySlots > 0 && (worst === null || worst.points >= 0);

  if (empty) {
    return (
      <MiniStat
        label='Lowest'
        value='0.0'
        detail='empty slot'
        hint={`${plural(
          row.emptySlots,
          `${GROUP_LABEL[row.group]} slot`,
        )} left empty`}
        tone='text-rose-300'
      />
    );
  }
  return (
    <MiniStat
      label='Lowest'
      value={worst ? worst.points.toFixed(1) : '—'}
      detail={worst?.shortName}
      hint={worst ? `${worst.name}, ${weekLabel(worst)}` : undefined}
    />
  );
}

function LineupLog({ seasons }: { seasons: DfsSeason[] }) {
  const years = seasons.map(season => season.year);
  const [year, setYear] = useState<number | 'all'>(years[0]);
  const [open, setOpen] = useState<string | null>(null);
  const weeks = seasons
    .filter(season => year === 'all' || season.year === year)
    .flatMap(season => [...season.weeks].reverse());

  return (
    <ProfileSection
      title='Lineup Log'
      action={<YearFilter years={years} value={year} onChange={setYear} />}
    >
      <ProfileTable
        headers={['Year', 'Week', 'Total', 'vs Field', 'Rank', '']}
        numericColumns={[2, 3, 4]}
      >
        {weeks.map(week => {
          const key = `${week.year}-${week.week}`;
          const isOpen = open === key;
          return (
            <Fragment key={key}>
              <tr
                className={clsx(
                  'cursor-pointer border-b border-slate-700/70 hover:bg-slate-700/30',
                  isOpen && 'bg-slate-700/30',
                )}
                onClick={() => setOpen(isOpen ? null : key)}
              >
                <td className='px-2 py-2'>
                  <button
                    type='button'
                    aria-expanded={isOpen}
                    aria-label={`${isOpen ? 'Hide' : 'Show'} the ${
                      week.year
                    } week ${week.week} lineup`}
                    className='inline-flex items-center gap-1.5'
                  >
                    <span
                      aria-hidden='true'
                      className={clsx(
                        'inline-block text-[0.6rem] text-slate-400 transition-transform',
                        isOpen && 'rotate-90',
                      )}
                    >
                      ▶
                    </span>
                    {week.year}
                  </button>
                </td>
                <td className='px-2 py-2 tabular-nums'>{week.week}</td>
                <td className='px-2 py-2 text-right font-medium tabular-nums'>
                  {week.total.toFixed(2)}
                </td>
                <td
                  className={clsx(
                    'px-2 py-2 text-right tabular-nums',
                    signedTone(week.vsField),
                  )}
                >
                  {signed(week.vsField)}
                </td>
                <td className='whitespace-nowrap px-2 py-2 text-right tabular-nums'>
                  {ordinal(week.rank)}
                  <span className='text-slate-400'> / {week.fieldSize}</span>
                </td>
                <td className='whitespace-nowrap px-2 py-2'>
                  {week.rank === 1 && (
                    <Tag tone='win' className='mr-1 last:mr-0'>
                      Won week
                    </Tag>
                  )}
                  {week.emptySlots > 0 && (
                    <Tag tone='highlight'>
                      {plural(week.emptySlots, 'empty slot')}
                    </Tag>
                  )}
                </td>
              </tr>
              {isOpen && (
                <tr className='border-b border-slate-700/70 bg-slate-900/40'>
                  <td colSpan={6} className='px-2 py-3'>
                    <LineupDetail week={week} />
                  </td>
                </tr>
              )}
            </Fragment>
          );
        })}
      </ProfileTable>
    </ProfileSection>
  );
}

function LineupDetail({ week }: { week: DfsWeek }) {
  return (
    <ul className='m-0 grid list-none gap-x-6 gap-y-1 p-0 md:grid-cols-2'>
      {week.picks.map(pick => (
        <li
          key={pick.slot}
          className='flex items-center gap-2 border-b border-slate-800 py-1 text-sm last:border-b-0'
        >
          <span className='w-11 shrink-0 text-right text-[0.7rem] font-bold uppercase tracking-wide text-slate-400'>
            {formatSlotName(pick.slot as DfsSurvivorSlot)}
          </span>
          <PositionChip position={pick.position} />
          <span className='min-w-0 flex-1 truncate text-slate-100'>
            {pick.name}
          </span>
          <span
            className='shrink-0 text-xs text-slate-400'
            title={
              pick.others.count > 0
                ? `${plural(
                    pick.others.count,
                    'other member',
                  )} used him, for ${pts(pick.others.average)} on average`
                : 'Nobody else used him that season'
            }
          >
            {pick.others.count > 0
              ? `others ${pts(pick.others.average, 1)} (${pick.others.count})`
              : 'only them'}
          </span>
          <span className='w-12 shrink-0 text-right font-semibold tabular-nums text-slate-100'>
            {pick.points.toFixed(2)}
          </span>
          <span
            className={clsx(
              'w-12 shrink-0 text-right text-xs tabular-nums',
              signedTone(pick.vsSlotField),
            )}
            title={`${signed(pick.vsSlotField)} against the field's ${
              GROUP_LABEL[pick.group]
            } pick that week`}
          >
            {signed(pick.vsSlotField, 1)}
          </span>
        </li>
      ))}
    </ul>
  );
}
