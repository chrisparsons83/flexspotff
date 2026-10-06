import { ClockIcon } from '@heroicons/react/solid';
import type { LoaderFunctionArgs } from '@remix-run/node';
import { Link, useOutletContext } from '@remix-run/react';
import clsx from 'clsx';
import type { ReactNode } from 'react';
import { Fragment, useEffect, useRef, useState } from 'react';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import CareerCard, { MiniStat } from '~/components/layout/profile/CareerCard';
import ContestEmptyState from '~/components/layout/profile/ContestEmptyState';
import InfoTip from '~/components/layout/profile/InfoTip';
import PositionChip from '~/components/layout/profile/PositionChip';
import ProfileSection from '~/components/layout/profile/ProfileSection';
import ProfileTable from '~/components/layout/profile/ProfileTable';
import RangeBar from '~/components/layout/profile/RangeBar';
import YearFilter from '~/components/layout/profile/YearFilter';
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

const pts = (value: number | null | undefined, digits = 2) =>
  value === null || value === undefined ? '—' : value.toFixed(digits);

/** "+2.10", "−1.35" - a proper minus, so the column lines up. */
const signed = (value: number, digits = 2) =>
  value > 0
    ? `+${value.toFixed(digits)}`
    : value < 0
    ? `−${(-value).toFixed(digits)}`
    : (0).toFixed(digits);

const signedTone = (value: number | null) =>
  value === null || value === 0
    ? 'text-slate-400'
    : value > 0
    ? 'text-emerald-300'
    : 'text-rose-300';

const plural = (count: number, noun: string) =>
  `${count} ${noun}${count === 1 ? '' : 's'}`;

const ordinal = (rank: number) => {
  const tens = rank % 100;
  if (tens >= 11 && tens <= 13) return `${rank}th`;
  return `${rank}${['th', 'st', 'nd', 'rd'][rank % 10] ?? 'th'}`;
};

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
                lowLabel={`${worstWeek.year} Week ${worstWeek.week}`}
                highLabel={`${bestWeek.year} Week ${bestWeek.week}`}
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
            tone={career.weeklyWins > 0 ? 'text-gold' : undefined}
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

/** Context set beside a card's headline, in place of a line under it. */
function LeadContext({ children }: { children: ReactNode }) {
  return (
    <span className='ml-2 text-sm font-normal leading-none text-slate-400'>
      {children}
    </span>
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

/**
 * Finished seasons grouped by how they ended, lightest for the best, so the
 * bar reads the same without the gold. Each season sits in its best band
 * only, so a title is gold alone rather than also filling Top 3 and Top 5.
 */
const FINISH_BANDS = [
  { label: 'Won', max: 1, tone: 'bg-gold' },
  { label: 'Top 3', max: 3, tone: 'bg-slate-200' },
  { label: 'Top 5', max: 5, tone: 'bg-slate-400' },
  { label: '6th+', max: Infinity, tone: 'bg-slate-600' },
];

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

  const bandCounts = FINISH_BANDS.map((band, index) => ({
    ...band,
    count: finished.filter(
      rank => rank <= band.max && rank > (FINISH_BANDS[index - 1]?.max ?? 0),
    ).length,
  }));

  return (
    <CareerCard
      title='Best Season Results'
      lead={
        career.titles > 0 ? (
          <span className='text-gold'>
            🏆{career.titles > 1 && ` × ${career.titles}`}
            <LeadContext>{plural(career.titles, 'title')}</LeadContext>
          </span>
        ) : (
          <>
            {ordinal(career.bestFinish!.rank)}
            <LeadContext>{career.bestFinish!.year}</LeadContext>
          </>
        )
      }
      meter={
        <>
          <div
            aria-hidden='true'
            className='flex h-2 gap-0.5 overflow-hidden rounded-full bg-slate-700'
          >
            {bandCounts
              .filter(band => band.count > 0)
              .map(band => (
                <div
                  key={band.label}
                  className={band.tone}
                  style={{ width: `${(band.count / finished.length) * 100}%` }}
                />
              ))}
          </div>
          <div className='mt-2 flex flex-wrap gap-x-2.5 gap-y-1 text-[0.65rem] leading-4 text-slate-400'>
            {bandCounts.map(({ count, label, tone }) => (
              <span key={label} className='inline-flex items-center gap-1'>
                <span
                  aria-hidden='true'
                  className={clsx('inline-block h-1.5 w-3 rounded-full', tone)}
                />
                <span className='font-semibold tabular-nums text-slate-200'>
                  {count}
                </span>
                {label}
              </span>
            ))}
          </div>
        </>
      }
    >
      <MiniStat
        label='Avg Finish'
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

/** A RangeBar with its two ends named underneath. */
function LabelledRange({
  low,
  high,
  mark,
  lowLabel,
  highLabel,
}: {
  low: number;
  high: number;
  mark: number;
  lowLabel: string;
  highLabel: string;
}) {
  return (
    <>
      <RangeBar low={low} high={high} mark={mark} />
      <div className='mt-2 flex justify-between gap-2 text-xs'>
        <span className='min-w-0 truncate'>
          <span className='font-semibold tabular-nums text-rose-300'>
            {low.toFixed(2)}
          </span>{' '}
          <span className='text-slate-500'>{lowLabel}</span>
        </span>
        <span className='min-w-0 truncate text-right'>
          <span className='text-slate-500'>{highLabel}</span>{' '}
          <span className='font-semibold tabular-nums text-emerald-300'>
            {high.toFixed(2)}
          </span>
        </span>
      </div>
    </>
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
          'Avg Week',
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
              </td>
              <td className='whitespace-nowrap px-2 py-2'>
                <SeasonFinish season={season} />
              </td>
              <td className='whitespace-nowrap px-2 py-2 text-right font-medium tabular-nums'>
                {pts(season.total)}
              </td>
              <td className='whitespace-nowrap px-2 py-2 text-right tabular-nums'>
                {season.weeks.length}
                <span className='text-slate-500'>
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
                    <span className='ml-1.5 text-xs text-slate-500'>
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
                  season.weeklyWins > 0 ? 'text-gold' : 'text-slate-400',
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

function SeasonFinish({ season }: { season: DfsSeason }) {
  if (!season.finish) return <>—</>;
  const champion = season.finish.rank === 1 && !season.inProgress;

  return (
    <span
      className={clsx('font-medium', champion ? 'text-gold' : 'text-slate-100')}
    >
      {champion && '🏆 '}
      {ordinal(season.finish.rank)}
      <span className='font-normal text-slate-400'>
        {' '}
        of {season.finish.fieldSize}
        {season.inProgress && ' so far'}
      </span>
    </span>
  );
}

/**
 * Where a week's total ranked in the field, bottom to top as dark red to
 * bright green. Ranking rather than raw points, so the late weeks - when
 * everyone's pool has thinned - do not paint the whole row red.
 *
 * Lightness climbs with the rank as well as hue, so the scale still reads for
 * red-green colour blindness: bright is good, dark is bad.
 */
const WEEK_SCALE = [
  { tone: 'bg-emerald-300 text-emerald-950', label: 'Top 20%' },
  { tone: 'bg-emerald-500 text-emerald-950', label: '60-80%' },
  { tone: 'bg-slate-600 text-slate-100', label: '40-60%' },
  { tone: 'bg-rose-800 text-rose-50', label: '20-40%' },
  { tone: 'bg-rose-950 text-rose-200', label: 'Bottom 20%' },
];

/**
 * A week won is set in heavy, underlined type, so it stands out by shape and
 * never relies on its colour, which it shares with the rest of the top band.
 */
const WEEK_WON_TEXT = 'underline decoration-2 underline-offset-2';

function weekTone(week: DfsWeek): string {
  const percentile =
    week.fieldSize > 1
      ? (week.fieldSize - week.rank) / (week.fieldSize - 1)
      : 1;
  // Walks down from the top band; a week won is always in it.
  const band =
    week.rank === 1
      ? 0
      : [0.8, 0.6, 0.4, 0.2].findIndex(floor => percentile >= floor);
  return WEEK_SCALE[band === -1 ? WEEK_SCALE.length - 1 : band].tone;
}

const describeWeek = (week: DfsWeek) =>
  `${week.year} Week ${week.week}: ${week.total.toFixed(2)} pts, ${ordinal(
    week.rank,
  )} of ${week.fieldSize}${week.rank === 1 ? ', won the week' : ''}${
    week.emptySlots > 0 ? `. ${plural(week.emptySlots, 'empty slot')}` : ''
  }`;

/** Every season as a strip of weeks, so a career's hot and cold runs show. */
function WeekByWeek({ seasons }: { seasons: DfsSeason[] }) {
  const weekNumbers = Array.from(
    { length: DFS_SURVIVOR_LAST_WEEK },
    (_, i) => i + 1,
  );

  return (
    <ProfileSection
      title='Week by Week'
      description='Each week shaded by where it ranked among everyone who set a lineup'
    >
      <div className='overflow-x-auto'>
        <div
          className='grid gap-1.5 p-0.5 text-xs'
          style={{
            gridTemplateColumns: `3rem repeat(${DFS_SURVIVOR_LAST_WEEK}, minmax(3.25rem, 1fr))`,
          }}
        >
          <div />
          {weekNumbers.map(week => (
            <div key={week} className='text-center text-slate-500'>
              {week}
            </div>
          ))}

          {seasons.map(season => {
            const byWeek = new Map(season.weeks.map(week => [week.week, week]));
            const scored = new Set(season.scoredWeeks);
            return (
              <Fragment key={season.year}>
                <div className='flex h-8 items-center font-medium tabular-nums text-slate-300'>
                  {season.year}
                </div>
                {weekNumbers.map(number => {
                  const week = byWeek.get(number);
                  if (week) {
                    return (
                      <div
                        key={number}
                        title={describeWeek(week)}
                        className={clsx(
                          'relative flex h-8 items-center justify-center rounded font-semibold tabular-nums',
                          weekTone(week),
                          week.rank === 1 && WEEK_WON_TEXT,
                        )}
                      >
                        {week.total.toFixed(1)}
                        {week.emptySlots > 0 && <PartialMark />}
                        <span className='sr-only'>. {describeWeek(week)}</span>
                      </div>
                    );
                  }
                  // Scored without them is a week skipped; not scored yet is
                  // simply still to come.
                  return scored.has(number) ? (
                    <div
                      key={number}
                      title={`${season.year} Week ${number}: no lineup`}
                      className='flex h-8 items-center justify-center rounded border border-dashed border-slate-600 text-slate-500'
                    >
                      –
                      <span className='sr-only'>
                        {season.year} week {number}: no lineup
                      </span>
                    </div>
                  ) : (
                    <div
                      key={number}
                      aria-hidden='true'
                      className='flex h-8 items-center justify-center rounded bg-slate-900/40 text-slate-600'
                    >
                      ·
                    </div>
                  );
                })}
              </Fragment>
            );
          })}
        </div>
      </div>
      <WeekLegend />
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

function Swatch({ tone, children }: { tone: string; children?: ReactNode }) {
  return (
    <span
      className={clsx(
        'relative inline-flex h-4 w-5 items-center justify-center rounded-sm',
        tone,
      )}
    >
      {children}
    </span>
  );
}

function WeekLegend() {
  return (
    <div className='mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400'>
      <span className='inline-flex items-center gap-1.5'>
        <Swatch tone={clsx(WEEK_SCALE[0].tone, 'w-7 text-[0.65rem]')}>
          <span className={clsx('font-semibold', WEEK_WON_TEXT)}>140</span>
        </Swatch>
        Week won
      </span>
      <span className='inline-flex items-center gap-1'>
        {WEEK_SCALE[0].label}
        {WEEK_SCALE.map(({ tone, label }) => (
          <span key={tone} title={label}>
            <Swatch tone={tone} />
          </span>
        ))}
        {WEEK_SCALE[WEEK_SCALE.length - 1].label}
      </span>
      <span className='inline-flex items-center gap-1.5'>
        <Swatch tone={WEEK_SCALE[2].tone}>
          <PartialMark />
        </Swatch>
        Empty slots
      </span>
      <span className='inline-flex items-center gap-1.5'>
        <Swatch tone='border border-dashed border-slate-600' />
        No lineup
      </span>
    </div>
  );
}

const CHART = { height: 260, left: 40, right: 12, top: 12, bottom: 28 };

/**
 * The element's width in pixels, so a chart can be drawn at its real size and
 * keep its labels at 11px on a phone and a desktop alike, rather than scaling
 * them with a viewBox. Starts from a guess for the server render.
 */
function useWidth<T extends HTMLElement>(initial: number) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(initial);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.round(entry.contentRect.width)),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return [ref, width] as const;
}

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
  const [chartRef, width] = useWidth<HTMLDivElement>(720);

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

  const plotWidth = width - CHART.left - CHART.right;
  const plotHeight = CHART.height - CHART.top - CHART.bottom;
  const x = (week: number) =>
    CHART.left + ((week - 1) / (lastWeek - 1)) * plotWidth;
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
  // Every other week once they get too close to label, as on a phone.
  const weekStep = plotWidth / lastWeek < 24 ? 2 : 1;

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
        <span className='inline-flex flex-wrap items-center gap-x-4 gap-y-1'>
          <ChartKey>
            <span className='inline-block h-0.5 w-4 rounded bg-sky-400' />
            Their lineup
          </ChartKey>
          <ChartKey>
            <span className='inline-block h-2 w-2 rounded-full bg-gold' />
            Week won
          </ChartKey>
          <ChartKey>
            <span className='inline-block w-4 border-t border-dashed border-slate-300' />
            Median
          </ChartKey>
          <ChartKey>
            <span className='inline-block h-2.5 w-4 rounded-sm bg-slate-400/30' />
            Middle half of the field
          </ChartKey>
          <ChartKey>
            <span className='inline-block h-2.5 w-4 rounded-sm bg-slate-400/10' />
            Lowest to highest
          </ChartKey>
        </span>
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
                x1={CHART.left}
                x2={width - CHART.right}
                y1={y(value)}
                y2={y(value)}
                className={
                  value === 0 ? 'stroke-slate-400' : 'stroke-slate-700'
                }
                strokeWidth={1}
              />
              <text
                x={CHART.left - 6}
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

function ChartKey({ children }: { children: ReactNode }) {
  return <span className='inline-flex items-center gap-1.5'>{children}</span>;
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
    return <td className='px-2 py-2 text-right text-slate-600'>—</td>;
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
      description='Each player can be used once a season, so the pool thins as it goes on'
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
              <span className='ml-1 text-xs text-slate-500'>per pick</span>
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
              className='border-b border-slate-700 pb-1 text-center text-slate-500'
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
          <div className='flex gap-1'>
            {(['best', 'worst'] as const).map(option => (
              <button
                key={option}
                type='button'
                onClick={() => setOrder(option)}
                className={clsx(
                  'rounded px-2.5 py-1 text-sm',
                  order === option
                    ? 'bg-white font-medium text-slate-900'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600',
                )}
              >
                {option === 'best' ? 'Best calls' : 'Worst calls'}
              </button>
            ))}
          </div>
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
            'Pts',
            'Others',
            'Others Avg',
            '+/−',
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
                  className='flex items-center gap-2 text-xs tabular-nums text-slate-500'
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
        <button
          type='button'
          onClick={() => setShowAll(value => !value)}
          className='mt-3 rounded bg-slate-700 px-3 py-1 text-sm text-slate-300 hover:bg-slate-600'
        >
          {showAll ? 'Show fewer' : `Show all ${compared.length} picks`}
        </button>
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
      description='Their average pick in each slot, against the field’s in the weeks they played'
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
        hint={
          row.best
            ? `${row.best.name}, ${row.best.year} Week ${row.best.week}`
            : undefined
        }
        tone={
          row.best && row.best.points >= BIG_PICK
            ? 'text-emerald-300'
            : undefined
        }
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
            <span className='text-xs text-slate-500'>average</span>
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
      hint={
        worst ? `${worst.name}, ${worst.year} Week ${worst.week}` : undefined
      }
    />
  );
}

function Tag({ tone, children }: { tone: string; children: ReactNode }) {
  return (
    <span
      className={clsx('mr-1 rounded px-1.5 py-0.5 text-xs last:mr-0', tone)}
    >
      {children}
    </span>
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
                        'inline-block text-[0.6rem] text-slate-500 transition-transform',
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
                  <span className='text-slate-500'> / {week.fieldSize}</span>
                </td>
                <td className='whitespace-nowrap px-2 py-2'>
                  {week.rank === 1 && (
                    <Tag tone='bg-emerald-400/15 text-emerald-200'>
                      Won week
                    </Tag>
                  )}
                  {week.emptySlots > 0 && (
                    <Tag tone='bg-amber-400/15 text-amber-200'>
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
          <span className='w-11 shrink-0 text-right text-[0.7rem] font-bold uppercase tracking-wide text-slate-500'>
            {formatSlotName(pick.slot as DfsSurvivorSlot)}
          </span>
          <PositionChip position={pick.position} />
          <span className='min-w-0 flex-1 truncate text-slate-100'>
            {pick.name}
          </span>
          <span
            className='shrink-0 text-xs text-slate-500'
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
          <span
            className={clsx(
              'w-12 shrink-0 text-right font-semibold tabular-nums',
              signedTone(pick.vsSlotField),
            )}
            title={`${signed(pick.vsSlotField)} vs the field's ${
              GROUP_LABEL[pick.group]
            } pick that week`}
          >
            {pick.points.toFixed(2)}
          </span>
        </li>
      ))}
    </ul>
  );
}
