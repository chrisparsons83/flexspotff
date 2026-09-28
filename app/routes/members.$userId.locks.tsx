import type { LoaderFunctionArgs } from '@remix-run/node';
import { Link, useOutletContext } from '@remix-run/react';
import clsx from 'clsx';
import type { ReactNode } from 'react';
import { Fragment, useEffect, useRef, useState } from 'react';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import CareerCard, { MiniStat } from '~/components/layout/profile/CareerCard';
import ContestEmptyState from '~/components/layout/profile/ContestEmptyState';
import ProfileSection from '~/components/layout/profile/ProfileSection';
import ProfileTable from '~/components/layout/profile/ProfileTable';
import RangeBar from '~/components/layout/profile/RangeBar';
import SplitBar from '~/components/layout/profile/SplitBar';
import YearFilter from '~/components/layout/profile/YearFilter';
import { requireProfileAccess } from '~/models/profile/access.server';
import { getLocksProfile } from '~/models/profile/locks.server';
import {
  CHALK_SHARE,
  type LocksCareer,
  type LocksFinish,
  type LocksPick,
  type LocksRecord,
  type LocksSeason,
  type LocksSplits,
  type LocksTeamRow,
  type LocksWeek,
  type RiskBucket,
  type SplitBucket,
  winRate,
} from '~/models/profile/locksProfile';
import { settledRank } from '~/models/profile/spreadPoolProfile';
import type { ProfileSummary } from '~/models/profile/summary.server';

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  await requireProfileAccess(request);

  const { userId } = params;
  if (!userId) throw new Response('Not Found', { status: 404 });

  return typedjson({ profile: await getLocksProfile(userId) });
};

/** "+2", "−1" - a proper minus, so the column lines up. */
const signed = (value: number, digits = 0) =>
  value > 0
    ? `+${value.toFixed(digits)}`
    : value < 0
    ? `−${(-value).toFixed(digits)}`
    : (0).toFixed(digits);

const pct = (value: number | null, digits = 1) =>
  value === null ? '—' : `${(value * 100).toFixed(digits)}%`;

const plural = (count: number, noun: string) =>
  `${count} ${noun}${count === 1 ? '' : 's'}`;

const ordinal = (rank: number) => {
  const tens = rank % 100;
  if (tens >= 11 && tens <= 13) return `${rank}th`;
  return `${rank}${['th', 'st', 'nd', 'rd'][rank % 10] ?? 'th'}`;
};

/** "T-2nd" when someone else finished on the same points. */
const place = (finish: Pick<LocksFinish, 'rank' | 'tied'>) =>
  `${finish.tied ? 'T-' : ''}${ordinal(finish.rank)}`;

const record = ({ wins, losses, ties }: LocksRecord) =>
  `${wins}-${losses}${ties ? `-${ties}` : ''}`;

/** The line as a bettor reads it: "−3", "+6.5", "PK". */
const line = (spread: number) =>
  spread === 0 ? 'PK' : signed(spread, spread % 1 === 0 ? 0 : 1);

const weekLabel = (week: { year: number; week: number }) =>
  `${week.year} Week ${week.week}`;

export default function MemberLocks() {
  const { profile } = useTypedLoaderData<typeof loader>();
  const summary = useOutletContext<ProfileSummary>();

  if (!profile.hasPlayed) {
    return (
      <ContestEmptyState
        contest='the Locks Challenge'
        memberName={summary.user.discordName}
      />
    );
  }

  return (
    <div className='space-y-8'>
      <Career career={profile.career} seasons={profile.seasons} />
      <BySeason seasons={profile.seasons} />
      <PointsRace seasons={profile.seasons} />
      <WeekByWeek seasons={profile.seasons} />
      <RiskProfile buckets={profile.risk} />
      <FavoritesAndUnderdogs splits={profile.splits} />
      <Tendencies splits={profile.splits} />
      <Teams rows={profile.teams} names={profile.teamNames} />
      <PickLog seasons={profile.seasons} />
    </div>
  );
}

/**
 * Context set inline after a card's headline, in place of a line under it.
 * Line height none, so a card with it is no taller than a card without.
 */
function LeadContext({ children }: { children: ReactNode }) {
  return (
    <span className='ml-2 text-sm font-normal leading-none text-slate-400'>
      {children}
    </span>
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
            {low}
          </span>{' '}
          <span className='text-slate-500'>{lowLabel}</span>
        </span>
        <span className='min-w-0 truncate text-right'>
          <span className='text-slate-500'>{highLabel}</span>{' '}
          <span className='font-semibold tabular-nums text-emerald-300'>
            {high}
          </span>
        </span>
      </div>
    </>
  );
}

/**
 * The counts under a SplitBar, in its colours. Every card with a bar has a row
 * like this under it, which is also what keeps their small stats level - so it
 * is set on the same 16px line as the labels under a LabelledRange.
 */
function BarKey({
  entries,
}: {
  entries: { count: number; label: string; tone: string }[];
}) {
  return (
    <div className='mt-2 flex flex-wrap gap-x-2.5 gap-y-1 text-[0.65rem] leading-4 text-slate-400'>
      {entries.map(({ count, label, tone }) => (
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
  );
}

/** "W16 ’24" - a week short enough to trail a small stat. */
const shortWeek = (week: { year: number; week: number }) =>
  `W${week.week} ’${String(week.year).slice(-2)}`;

/** A week's record as a small stat, with when it happened trailing it. */
function WeekStat({
  label,
  week,
  value,
  hint,
  tone,
}: {
  label: string;
  week: LocksWeek | null;
  value: (week: LocksWeek) => ReactNode;
  hint: string;
  tone?: string;
}) {
  return (
    <MiniStat
      label={label}
      value={week ? value(week) : '—'}
      detail={week ? shortWeek(week) : null}
      hint={week ? `${hint}: ${weekLabel(week)}, ${record(week.record)}` : hint}
      tone={week ? tone : undefined}
    />
  );
}

/**
 * Busted weeks by how many losses sank them, darkest for the most. A bust by
 * one is the one that stings, so it gets the brightest red.
 */
const BUST_BANDS = [
  { key: 'one', label: 'by 1', tone: 'bg-rose-300' },
  { key: 'two', label: 'by 2', tone: 'bg-rose-500' },
  { key: 'more', label: 'by 3+', tone: 'bg-rose-800' },
] as const;

function Career({
  career,
  seasons,
}: {
  career: LocksCareer;
  seasons: LocksSeason[];
}) {
  const finished = seasons.filter(season => !season.inProgress);
  const averagePoints =
    finished.length > 0
      ? finished.reduce((total, season) => total + season.points, 0) /
        finished.length
      : null;
  const busted = career.weeksEntered - career.cleanWeeks;
  const bustBands = BUST_BANDS.map(band => ({
    ...band,
    count: career.bustsByLosses[band.key],
  }));

  return (
    <ProfileSection title='Career'>
      <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-4'>
        <CareerCard
          title='Points Scored'
          lead={career.points}
          meter={
            // One finished season would put the same total at both ends, so
            // it keeps the bar's space instead, to stay level with the rest.
            finished.length > 1 &&
            career.bestSeason &&
            career.worstSeason &&
            averagePoints !== null ? (
              <LabelledRange
                low={career.worstSeason.points}
                high={career.bestSeason.points}
                mark={averagePoints}
                lowLabel={String(career.worstSeason.year)}
                highLabel={String(career.bestSeason.year)}
              />
            ) : (
              <div aria-hidden='true' className='h-8' />
            )
          }
        >
          <MiniStat
            label='Weeks Won'
            value={career.weeksWon}
            hint='Weeks with the most points of everyone who entered'
            tone={career.weeksWon > 0 ? 'text-gold' : undefined}
          />
          <MiniStat
            label='Correct'
            value={career.record.wins}
            hint={`Picks that won${
              career.record.ties
                ? `, with ${plural(career.record.ties, 'tie')} besides`
                : ''
            }`}
            tone='text-emerald-300'
          />
          <MiniStat
            label='Incorrect'
            value={career.record.losses}
            hint='Picks that lost'
            tone={career.record.losses > 0 ? 'text-rose-300' : undefined}
          />
        </CareerCard>

        <CareerCard
          title='Scoring Weeks'
          lead={career.cleanWeeks}
          meter={
            <>
              <SplitBar wins={career.cleanWeeks} losses={busted} />
              <BarKey
                entries={[
                  {
                    count: career.cleanWeeks,
                    label: 'scored',
                    tone: 'bg-emerald-400',
                  },
                  { count: busted, label: 'busted', tone: 'bg-rose-400' },
                ]}
              />
            </>
          }
        >
          <WeekStat
            label='Biggest'
            week={career.bestWeek}
            value={week => week.points}
            hint='Most points in a week'
            tone='text-emerald-300'
          />
          <WeekStat
            label='Smallest'
            week={career.smallestWin}
            value={week => week.points}
            hint='Fewest points in a week that scored'
          />
          <MiniStat
            label='Longest Streak'
            value={career.longestCleanStreak}
            unit={career.longestCleanStreak === 1 ? 'week' : 'weeks'}
            hint='Most scoring weeks in a row, counting only weeks entered'
          />
        </CareerCard>

        <CareerCard
          title='Busts'
          lead={
            <>
              {career.forfeited}
              <LeadContext>
                {career.forfeited === 1 ? 'win' : 'wins'} wiped out
              </LeadContext>
            </>
          }
          meter={
            <>
              <div
                aria-hidden='true'
                className='flex h-2 gap-0.5 overflow-hidden rounded-full bg-slate-700'
              >
                {busted > 0 &&
                  bustBands
                    .filter(band => band.count > 0)
                    .map(band => (
                      <div
                        key={band.key}
                        className={band.tone}
                        style={{ width: `${(band.count / busted) * 100}%` }}
                      />
                    ))}
              </div>
              <BarKey entries={bustBands} />
            </>
          }
        >
          <WeekStat
            label='Biggest Miss'
            week={career.worstBust}
            value={week => record(week.record)}
            hint='The bust that wiped out the most wins'
            tone='text-rose-300'
          />
          <WeekStat
            label='Nearest Miss'
            week={career.nearMiss}
            value={week => record(week.record)}
            hint='The most wins a single loss wiped out'
            tone='text-rose-300'
          />
        </CareerCard>

        <FinishesCard career={career} seasons={seasons} />
      </div>
    </ProfileSection>
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
  career: LocksCareer;
  seasons: LocksSeason[];
}) {
  const finished = seasons.flatMap(season => {
    const rank = season.inProgress ? null : settledRank(season);
    return rank === null ? [] : [rank];
  });

  // A member still in their first season has no finishes yet; show where
  // they stand instead.
  if (finished.length === 0) {
    return career.standing ? (
      <CareerCard
        title='Standing'
        lead={
          <>
            {place(career.standing)}
            <LeadContext>
              of {career.standing.fieldSize} in {career.standing.year}
            </LeadContext>
          </>
        }
      >
        <MiniStat label='Weeks Entered' value={career.weeksEntered} />
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
            {place(career.bestFinish!)}
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
          <BarKey entries={bandCounts} />
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

function BySeason({ seasons }: { seasons: LocksSeason[] }) {
  return (
    <ProfileSection title='By Season'>
      <ProfileTable
        headers={[
          'Year',
          'Finish',
          'Points',
          'Record',
          'Win %',
          'Scoring Weeks',
          'Best Week',
          'Lost to Busts',
        ]}
        numericColumns={[2, 3, 4, 5, 6, 7]}
      >
        {seasons.map(season => (
          <tr key={season.year} className='border-b border-slate-700/70'>
            <td className='px-2 py-2'>
              <Link to={`/games/locks-challenge/standings/${season.year}`}>
                {season.year}
              </Link>
              {season.inProgress && <CurrentTag />}
            </td>
            <td className='whitespace-nowrap px-2 py-2'>
              <SeasonFinish season={season} />
            </td>
            <td className='px-2 py-2 text-right font-medium tabular-nums'>
              {season.points}
            </td>
            <td className='whitespace-nowrap px-2 py-2 text-right tabular-nums'>
              {record(season.record)}
            </td>
            <td className='px-2 py-2 text-right tabular-nums'>
              {pct(winRate(season.record))}
            </td>
            <td className='whitespace-nowrap px-2 py-2 text-right tabular-nums'>
              {season.cleanWeeks}
              <span className='text-slate-500'> of {season.weeks.length}</span>
            </td>
            <td className='whitespace-nowrap px-2 py-2 text-right tabular-nums'>
              {season.bestWeek ? (
                <>
                  {season.bestWeek.points}
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
                season.forfeited > 0 ? 'text-rose-300' : 'text-slate-500',
              )}
            >
              {season.forfeited}
            </td>
          </tr>
        ))}
      </ProfileTable>
    </ProfileSection>
  );
}

function SeasonFinish({ season }: { season: LocksSeason }) {
  if (!season.finish) return <>—</>;

  return (
    <span
      className={clsx(
        'font-medium',
        season.champion ? 'text-gold' : 'text-slate-100',
      )}
    >
      {season.champion && '🏆 '}
      {place(season.finish)}
      <span className='font-normal text-slate-400'>
        {' '}
        of {season.finish.fieldSize}
      </span>
    </span>
  );
}

/** Marks the season still being played, whose numbers are still moving. */
function CurrentTag() {
  return (
    <span className='ml-2 rounded bg-sky-400/15 px-1.5 py-0.5 text-xs font-medium text-sky-200'>
      Current
    </span>
  );
}

const CHART = { height: 260, left: 36, right: 12, top: 12, bottom: 28 };

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
  return [1, 2, 5, 10, 20, 25, 50].find(step => ceiling / step <= 6) ?? 100;
}

/**
 * The member's points through a season, over the field's: the middle half as
 * a band, the whole spread fainter behind it - its top edge is the leader -
 * and the median as a dashed line. Every week of the season gets a point, so
 * a week sat out reads as a flat step rather than a slope.
 */
function PointsRace({ seasons }: { seasons: LocksSeason[] }) {
  const years = seasons.map(season => season.year);
  const [year, setYear] = useState<number | 'all'>(years[0]);
  const season = seasons.find(entry => entry.year === year) ?? seasons[0];
  const [chartRef, width] = useWidth<HTMLDivElement>(720);

  const byWeek = new Map(season.weeks.map(week => [week.week, week]));
  const lastWeek = Math.max(
    ...season.weeks.map(week => week.week),
    ...season.field.map(point => point.week),
    1,
  );
  let running = 0;
  const points: RacePoint[] = [
    { week: 0, total: 0, entered: null, label: 'Start' },
    ...Array.from({ length: lastWeek }, (_, index) => {
      const entered = byWeek.get(index + 1) ?? null;
      running = entered?.total ?? running;
      return {
        week: index + 1,
        total: running,
        entered,
        label: `Week ${index + 1}`,
      };
    }),
  ];
  const field = [
    { week: 0, low: 0, high: 0, q1: 0, q3: 0, median: 0 },
    ...season.field,
  ];

  const step = gridStep(
    Math.max(...points.map(p => p.total), ...field.map(p => p.high), 1),
  );
  const ceiling =
    Math.ceil(
      Math.max(...points.map(p => p.total), ...field.map(p => p.high), 1) /
        step,
    ) * step;

  const plotWidth = width - CHART.left - CHART.right;
  const plotHeight = CHART.height - CHART.top - CHART.bottom;
  const x = (week: number) => CHART.left + (week / lastWeek) * plotWidth;
  const y = (value: number) =>
    CHART.top + (1 - value / (ceiling || 1)) * plotHeight;

  const area = (upper: (p: (typeof field)[0]) => number, lower: typeof upper) =>
    [
      ...field.map(point => `${x(point.week)},${y(upper(point))}`),
      ...[...field]
        .reverse()
        .map(point => `${x(point.week)},${y(lower(point))}`),
    ].join(' ');

  const gridlines = Array.from(
    { length: ceiling / step + 1 },
    (_, index) => index * step,
  );
  // Every other week once they get too close to label, as on a phone.
  const weekStep = plotWidth / lastWeek < 24 ? 2 : 1;

  return (
    <ProfileSection
      title='Points Race'
      action={
        <YearFilter
          years={years}
          value={season.year}
          onChange={setYear}
          showAll={false}
        />
      }
      footnote={
        <span className='inline-flex flex-wrap items-center gap-x-4 gap-y-1'>
          <ChartKey>
            <span className='inline-block h-0.5 w-4 rounded bg-sky-400' />
            Points
          </ChartKey>
          <ChartKey>
            <span className='inline-block h-2.5 w-4 rounded-sm bg-slate-400/30' />
            Middle half of the field
          </ChartKey>
          <ChartKey>
            <span className='inline-block h-2.5 w-4 rounded-sm bg-slate-400/10' />
            Lowest to the leader
          </ChartKey>
          <ChartKey>
            <span className='inline-block w-4 border-t border-dashed border-slate-300' />
            Median
          </ChartKey>
          <ChartKey>
            <span className='inline-block h-2 w-2 rounded-full bg-rose-400' />
            Busted
          </ChartKey>
          <ChartKey>
            <span className='inline-block h-2 w-2 rounded-full border-2 border-slate-500' />
            Sat out
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
          aria-label={`Points through ${season.year}, week by week, against the rest of the field`}
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
          <polyline
            points={points
              .map(point => `${x(point.week)},${y(point.total)}`)
              .join(' ')}
            fill='none'
            className='stroke-sky-400'
            strokeWidth={2.5}
            strokeLinejoin='round'
          />
          {points.map(point => (
            <circle
              key={point.week}
              cx={x(point.week)}
              cy={y(point.total)}
              r={point.entered || point.week === 0 ? 3.5 : 3}
              className={
                point.week === 0
                  ? 'fill-sky-400 stroke-slate-900'
                  : !point.entered
                  ? 'fill-slate-900 stroke-slate-500'
                  : point.entered.clean
                  ? 'fill-sky-400 stroke-slate-900'
                  : 'fill-rose-400 stroke-slate-900'
              }
              strokeWidth={2}
            >
              {/* One string: a <title> with several children breaks hydration. */}
              <title>{describePoint(point)}</title>
            </circle>
          ))}
        </svg>
      </div>
    </ProfileSection>
  );
}

type RacePoint = {
  week: number;
  total: number;
  entered: LocksWeek | null;
  label: string;
};

function describePoint(point: RacePoint) {
  const base = `${point.label}: ${point.total}`;
  if (point.week === 0) return base;
  if (!point.entered) return `${base} (sat out)`;
  return `${base} (${
    point.entered.clean
      ? signed(point.entered.points)
      : `busted, ${record(point.entered.record)}`
  })`;
}

function ChartKey({ children }: { children: ReactNode }) {
  return <span className='inline-flex items-center gap-1.5'>{children}</span>;
}

/**
 * Green for a clean week, red for a busted one. They sit at opposite ends of
 * lightness - bright with dark type against dark with light type - and the
 * busted week has a dashed edge, so the two never rely on hue alone and still
 * read for red-green colour blindness.
 */
const CLEAN_TONE = 'bg-emerald-400 text-emerald-950';
const BUSTED_TONE =
  'border border-dashed border-rose-400/70 bg-rose-950 text-rose-300';

/**
 * A week won is set in underlined type, so it stands out by shape and never
 * relies on its colour, which it shares with every other clean week.
 */
const WEEK_WON_TEXT = 'underline decoration-2 underline-offset-2';

const RESULT_WORD = { win: 'Won', loss: 'Lost', tie: 'Tied' } as const;

const describePick = (pick: LocksPick) =>
  `${RESULT_WORD[pick.result]}: ${pick.team}${
    pick.spread === null ? '' : ` ${line(pick.spread)}`
  } ${pick.isHome ? 'vs' : '@'} ${pick.opponent}, ${pick.teamScore}–${
    pick.opponentScore
  }`;

const describeWeek = (week: LocksWeek) =>
  `${weekLabel(week)}: ${record(week.record)}, ${
    week.clean
      ? `${plural(week.points, 'point')}`
      : `busted, ${plural(week.forfeited, 'win')} lost`
  }. ${ordinal(week.rank)} of ${week.fieldSize}${
    week.rank === 1 && week.points > 0 ? ', won the week' : ''
  }.\n${week.picks.map(describePick).join('\n')}`;

/**
 * Every season as a strip of weeks, so a career's hot and cold runs show. A
 * clean week shows its points; a busted one, how many picks went down with it.
 */
function WeekByWeek({ seasons }: { seasons: LocksSeason[] }) {
  const lastWeek = Math.max(
    ...seasons.flatMap(season => season.weeks.map(week => week.week)),
  );
  const weekNumbers = Array.from({ length: lastWeek }, (_, i) => i + 1);

  return (
    <ProfileSection title='Week by Week'>
      <div className='overflow-x-auto'>
        <div
          className='grid gap-1.5 p-0.5 text-xs'
          style={{
            gridTemplateColumns: `3rem repeat(${lastWeek}, minmax(2.5rem, 1fr))`,
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
            return (
              <Fragment key={season.year}>
                <div className='flex h-8 items-center font-medium tabular-nums text-slate-300'>
                  {season.year}
                </div>
                {weekNumbers.map(number => {
                  const week = byWeek.get(number);
                  return week ? (
                    <div
                      key={number}
                      title={describeWeek(week)}
                      className={clsx(
                        // Relative, so the sr-only text inside is placed within the scroller
                        // rather than stretching the page on a phone.
                        'relative flex h-8 items-center justify-center rounded font-semibold tabular-nums',
                        week.clean ? CLEAN_TONE : BUSTED_TONE,
                        week.rank === 1 && week.points > 0 && WEEK_WON_TEXT,
                      )}
                    >
                      {week.clean ? week.points : week.picks.length}
                      <span className='sr-only'>. {describeWeek(week)}</span>
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
        <Swatch tone={clsx(CLEAN_TONE, 'text-[0.65rem]')}>
          <span className={clsx('font-semibold', WEEK_WON_TEXT)}>9</span>
        </Swatch>
        Week won
      </span>
    </div>
  );
}

/**
 * A rate on a 0-100% track, with the field's rate as a dot. There is no
 * break-even to draw from, so the bar runs from zero, green when it is at or
 * above the field and red when it is below.
 */
const FIELD_DOT =
  'absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-slate-900 bg-sky-300';

function RateBar({
  member,
  field,
}: {
  member: number | null;
  field: number | null;
}) {
  return (
    <div
      aria-hidden='true'
      className='relative h-2 w-full min-w-[6rem] rounded-full bg-slate-700'
    >
      {member !== null && (
        <div
          className={clsx(
            'absolute inset-y-0 left-0 rounded-full',
            field === null
              ? 'bg-sky-400'
              : member >= field
              ? 'bg-emerald-400'
              : 'bg-rose-400',
          )}
          style={{ width: `${member * 100}%` }}
        />
      )}
      {field !== null && (
        <div className={FIELD_DOT} style={{ left: `${field * 100}%` }} />
      )}
    </div>
  );
}

function FieldKey({ children }: { children: ReactNode }) {
  return (
    <span className='inline-flex items-center gap-1.5'>
      <span className='relative inline-block h-3 w-3'>
        <span className={clsx('left-1/2', FIELD_DOT)} />
      </span>
      {children}
    </span>
  );
}

/**
 * The trade at the heart of the game: every extra pick is another point if the
 * week stays clean, and another way to lose the lot. Each row is the weeks
 * they made that many picks, next to everyone else's.
 */
function RiskProfile({ buckets }: { buckets: RiskBucket[] }) {
  const memberWeeks = buckets.reduce((total, b) => total + b.member.weeks, 0);
  const bestBucket = buckets.reduce<RiskBucket | null>(
    (best, bucket) =>
      bucket.member.pointsPerWeek !== null &&
      (!best || bucket.member.pointsPerWeek > best.member.pointsPerWeek!)
        ? bucket
        : best,
    null,
  );

  return (
    <ProfileSection
      title='Risk Profile'
      footnote={<FieldKey>Field&rsquo;s performance</FieldKey>}
    >
      <ProfileTable
        headers={['Picks', 'Weeks', 'Scoring % vs field', 'Average Score']}
        numericColumns={[1, 3]}
      >
        {buckets.map(bucket => (
          <tr key={bucket.key} className='border-b border-slate-700/70'>
            <td className='whitespace-nowrap px-2 py-2 text-slate-100'>
              {bucket.label}
            </td>
            <td className='whitespace-nowrap px-2 py-2 text-right tabular-nums'>
              {bucket.member.weeks}
              <span className='ml-1.5 text-xs text-slate-500'>
                {memberWeeks > 0
                  ? `${Math.round((bucket.member.weeks / memberWeeks) * 100)}%`
                  : ''}
              </span>
            </td>
            <td
              className='w-1/2 px-2 py-2 tabular-nums'
              title={`Field: ${pct(bucket.field.cleanRate)} of ${plural(
                bucket.field.weeks,
                'week',
              )}`}
            >
              <div className='flex items-center gap-3'>
                <span className='w-24 shrink-0 whitespace-nowrap'>
                  {pct(bucket.member.cleanRate, 0)}
                  <span className='ml-1.5 text-xs text-slate-500'>
                    {pct(bucket.field.cleanRate, 0)}
                  </span>
                </span>
                <RateBar
                  member={bucket.member.cleanRate}
                  field={bucket.field.cleanRate}
                />
              </div>
            </td>
            <td className='whitespace-nowrap px-2 py-2 text-right tabular-nums'>
              <span
                className={clsx(
                  'font-medium',
                  bucket === bestBucket ? 'text-emerald-300' : 'text-slate-100',
                )}
              >
                {bucket.member.pointsPerWeek?.toFixed(2) ?? '—'}
              </span>
            </td>
          </tr>
        ))}
      </ProfileTable>
    </ProfileSection>
  );
}

/**
 * One row per bucket: how many picks went there, how they did, and how the
 * rest of the field did with the same kind of pick.
 */
function SplitTable({
  buckets,
  heading,
}: {
  buckets: SplitBucket[];
  heading: string;
}) {
  const memberPicks = buckets.reduce((total, b) => total + b.member.picks, 0);

  return (
    <ProfileTable
      headers={[heading, 'Picks', 'Record', 'Win % vs field']}
      numericColumns={[1, 2]}
    >
      {buckets.map(bucket => (
        <tr key={bucket.key} className='border-b border-slate-700/70'>
          <td className='whitespace-nowrap px-2 py-2 text-slate-100'>
            {bucket.label}
          </td>
          <td className='whitespace-nowrap px-2 py-2 text-right tabular-nums'>
            {bucket.member.picks}
            <span className='ml-1.5 text-xs text-slate-500'>
              {memberPicks > 0
                ? `${Math.round((bucket.member.picks / memberPicks) * 100)}%`
                : ''}
            </span>
          </td>
          <td className='whitespace-nowrap px-2 py-2 text-right tabular-nums'>
            {record(bucket.member)}
          </td>
          <td
            className='w-1/2 px-2 py-2 tabular-nums'
            title={`Field: ${pct(bucket.field.winRate)} on ${plural(
              bucket.field.picks,
              'pick',
            )}`}
          >
            <div className='flex items-center gap-3'>
              <span className='w-24 shrink-0 whitespace-nowrap'>
                {pct(bucket.member.winRate)}
                <span className='ml-1.5 text-xs text-slate-500'>
                  {pct(bucket.field.winRate)}
                </span>
              </span>
              <RateBar
                member={bucket.member.winRate}
                field={bucket.field.picks > 0 ? bucket.field.winRate : null}
              />
            </div>
          </td>
        </tr>
      ))}
    </ProfileTable>
  );
}

const WIN_RATE_KEY = <FieldKey>Field&rsquo;s performance</FieldKey>;

const SIDE_TONE: Record<string, string> = {
  favorite: 'bg-amber-400',
  underdog: 'bg-violet-400',
  pick: 'bg-slate-400',
  none: 'bg-slate-600',
};

/**
 * How their picks split between favorites and underdogs, with a tick where the
 * field's split falls - so a lean either way shows as the gap between the two.
 */
function ShareBar({
  buckets,
  consensus,
}: {
  buckets: SplitBucket[];
  /** The field's share on favorites, which is where the first segment ends. */
  consensus: number | null;
}) {
  const total = buckets.reduce((sum, bucket) => sum + bucket.member.picks, 0);
  const shareOf = (bucket: SplitBucket) =>
    total > 0 ? bucket.member.picks / total : 0;

  return (
    <div className='relative'>
      <div className='flex h-6 gap-0.5 overflow-hidden rounded'>
        {buckets
          .filter(bucket => shareOf(bucket) > 0)
          .map(bucket => (
            <div
              key={bucket.key}
              className={clsx(
                'flex items-center overflow-hidden whitespace-nowrap px-2 text-xs font-semibold text-slate-950',
                SIDE_TONE[bucket.key],
              )}
              style={{ width: `${shareOf(bucket) * 100}%` }}
              title={`${bucket.label}: ${Math.round(shareOf(bucket) * 100)}%`}
            >
              {shareOf(bucket) >= 0.12 &&
                `${bucket.label} ${Math.round(shareOf(bucket) * 100)}%`}
            </div>
          ))}
      </div>
      {consensus !== null && (
        <div
          className='absolute -inset-y-1 w-1 -translate-x-1/2 rounded-full bg-sky-300 shadow'
          style={{ left: `${consensus * 100}%` }}
          title={`Field: ${Math.round(consensus * 100)}% favorites`}
        />
      )}
    </div>
  );
}

/**
 * How their picks lean between favorites and underdogs, then how they have
 * done by the size of the line - which says the same as a favorites and
 * underdogs table, and more.
 */
function FavoritesAndUnderdogs({ splits }: { splits: LocksSplits }) {
  const fieldTotal = splits.side.reduce((t, b) => t + b.field.picks, 0);
  const favorite = splits.side.find(bucket => bucket.key === 'favorite');

  return (
    <ProfileSection
      title='Favorites & Underdogs'
      description='By the Spread Pool’s line on the same game'
      footnote={WIN_RATE_KEY}
    >
      <ShareBar
        buckets={splits.side}
        consensus={
          favorite && fieldTotal > 0 ? favorite.field.picks / fieldTotal : null
        }
      />
      <div className='mt-6'>
        <SplitTable buckets={splits.line} heading='Line' />
      </div>
    </ProfileSection>
  );
}

/** The other ways to slice a pick: the crowd, the venue and the clock. */
function Tendencies({ splits }: { splits: LocksSplits }) {
  const chalk = Math.round(CHALK_SHARE * 100);

  return (
    <ProfileSection
      title='Tendencies'
      footnote={
        <span className='inline-flex flex-wrap items-center gap-x-4 gap-y-1'>
          {WIN_RATE_KEY}
          <span>
            Chalk: {chalk}% or more of the others on the game took the same
            side. Contrarian: {100 - chalk}% or fewer.
          </span>
        </span>
      }
    >
      {/* min-w-0 lets each table scroll inside its cell on a phone, rather
          than widening the grid past the screen. */}
      <div className='grid gap-6 xl:grid-cols-2 [&>*]:min-w-0'>
        <SplitTable buckets={splits.slot} heading='Kickoff' />
        {/* The two short tables stack on the right, level with the long one. */}
        <div className='space-y-6 [&>*]:min-w-0'>
          <SplitTable buckets={splits.crowd} heading='Crowd' />
          <SplitTable buckets={splits.venue} heading='Venue' />
        </div>
      </div>
    </ProfileSection>
  );
}

type TeamSort = 'picks' | 'winRate' | 'busts';

const TEAM_SORTS: { key: TeamSort; label: string }[] = [
  { key: 'picks', label: 'Most picked' },
  { key: 'winRate', label: 'Win %' },
  { key: 'busts', label: 'Busts' },
];

const TEAMS_PREVIEW = 12;

/** Too few picks to call a team reliable. */
const RELIABLE_MIN_PICKS = 5;

function sortTeams(rows: LocksTeamRow[], sort: TeamSort) {
  const value = (row: LocksTeamRow) =>
    sort === 'picks'
      ? row.backing.picks
      : sort === 'winRate'
      ? winRate(row.backing) ?? -1
      : row.busts * 1000 + row.pointsCost;
  return [...rows].sort(
    (a, b) =>
      value(b) - value(a) ||
      b.backing.picks - a.backing.picks ||
      a.team.localeCompare(b.team),
  );
}

function TeamCallout({
  title,
  row,
  names,
  children,
}: {
  title: string;
  row: LocksTeamRow | undefined;
  names: Record<string, string>;
  children: ReactNode;
}) {
  if (!row) return null;
  return (
    <div className='rounded-md bg-slate-900/50 p-4'>
      <h4 className='m-0 text-sm font-semibold text-slate-300'>{title}</h4>
      <div className='mt-2 text-2xl font-bold leading-none text-white'>
        {row.team}
        <span className='ml-2 text-sm font-normal text-slate-400'>
          {names[row.team] ?? ''}
        </span>
      </div>
      <div className='mt-1.5 text-sm text-slate-400'>{children}</div>
    </div>
  );
}

/**
 * Every team they have picked or picked against. A bust is a week the team
 * lost in after they picked it; its points are the wins it alone threw away,
 * in weeks where it was the only loss.
 */
function Teams({
  rows,
  names,
}: {
  rows: LocksTeamRow[];
  names: Record<string, string>;
}) {
  const [sort, setSort] = useState<TeamSort>('picks');
  const [showAll, setShowAll] = useState(false);
  const sorted = sortTeams(rows, sort);
  const visible = showAll ? sorted : sorted.slice(0, TEAMS_PREVIEW);

  const mostPicked = sortTeams(rows, 'picks')[0];
  const reliable = sortTeams(
    rows.filter(row => row.backing.picks >= RELIABLE_MIN_PICKS),
    'winRate',
  )[0];
  const costliest = [...rows]
    .filter(row => row.pointsCost > 0)
    .sort((a, b) => b.pointsCost - a.pointsCost || b.busts - a.busts)[0];

  return (
    <ProfileSection
      title='By NFL Team'
      action={
        <div className='flex flex-wrap gap-1'>
          {TEAM_SORTS.map(option => (
            <button
              key={option.key}
              type='button'
              onClick={() => setSort(option.key)}
              className={clsx(
                'rounded px-2.5 py-1 text-sm',
                sort === option.key
                  ? 'bg-white font-medium text-slate-900'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      }
    >
      <div className='mb-5 grid gap-3 sm:grid-cols-3'>
        <TeamCallout title='Most Picked' row={mostPicked} names={names}>
          {mostPicked && (
            <>
              {plural(mostPicked.backing.picks, 'pick')},{' '}
              {record(mostPicked.backing)}
            </>
          )}
        </TeamCallout>
        <TeamCallout title='Most Reliable' row={reliable} names={names}>
          {reliable && (
            <>
              {pct(winRate(reliable.backing), 0)} won,{' '}
              {record(reliable.backing)}
            </>
          )}
        </TeamCallout>
        <TeamCallout title='Costliest Loss' row={costliest} names={names}>
          {costliest && (
            <>
              <span className='font-semibold text-rose-300'>
                {plural(costliest.pointsCost, 'point')}
              </span>{' '}
              lost as a week&rsquo;s only loss,{' '}
              {plural(costliest.busts, 'bust')} in all
            </>
          )}
        </TeamCallout>
      </div>

      <ProfileTable
        headers={['Team', 'Picked', 'Win %', 'Picked Against', 'Busts']}
        numericColumns={[1, 2, 3, 4]}
      >
        {visible.map(row => (
          <tr key={row.team} className='border-b border-slate-700/70'>
            <td
              className='whitespace-nowrap px-2 py-2 font-medium text-slate-100'
              title={names[row.team]}
            >
              {row.team}
            </td>
            <td className='whitespace-nowrap px-2 py-2 text-right tabular-nums'>
              {row.backing.picks > 0 ? (
                record(row.backing)
              ) : (
                <span className='text-slate-600'>—</span>
              )}
            </td>
            <td className='px-2 py-2 text-right tabular-nums'>
              {pct(winRate(row.backing), 0)}
            </td>
            <td className='whitespace-nowrap px-2 py-2 text-right tabular-nums text-slate-300'>
              {row.fading.picks > 0 ? (
                record(row.fading)
              ) : (
                <span className='text-slate-600'>—</span>
              )}
            </td>
            <td
              className='whitespace-nowrap px-2 py-2 text-right tabular-nums'
              title={
                row.busts > 0
                  ? `${plural(
                      row.pointsCost,
                      'point',
                    )} lost as a week’s only loss`
                  : undefined
              }
            >
              {row.busts > 0 ? (
                <>
                  <span className='text-rose-300'>{row.busts}</span>
                  {row.pointsCost > 0 && (
                    <span className='ml-1.5 text-xs text-slate-500'>
                      −{row.pointsCost}
                    </span>
                  )}
                </>
              ) : (
                <span className='text-slate-600'>0</span>
              )}
            </td>
          </tr>
        ))}
      </ProfileTable>
      {rows.length > TEAMS_PREVIEW && (
        <button
          type='button'
          onClick={() => setShowAll(value => !value)}
          className='mt-3 rounded bg-slate-700 px-3 py-1 text-sm text-slate-300 hover:bg-slate-600'
        >
          {showAll ? 'Show fewer' : `Show all ${rows.length} teams`}
        </button>
      )}
    </ProfileSection>
  );
}

function Tag({ tone, children }: { tone: string; children: ReactNode }) {
  return (
    <span className={clsx('rounded px-1.5 py-0.5 text-xs', tone)}>
      {children}
    </span>
  );
}

const RESULT_TAG: Record<LocksPick['result'], { tone: string; label: string }> =
  {
    win: { tone: 'bg-emerald-400/15 text-emerald-200', label: 'Won' },
    loss: { tone: 'bg-rose-400/15 text-rose-200', label: 'Lost' },
    tie: { tone: 'bg-slate-600/40 text-slate-300', label: 'Tie' },
  };

/** How many of the others on the game took the same side, and what that makes it. */
function FieldCell({ pick }: { pick: LocksPick }) {
  if (pick.fieldShare === null) {
    return <span className='text-slate-500'>Only pick</span>;
  }
  return (
    <span className='inline-flex items-center gap-1.5'>
      <span className='tabular-nums text-slate-300'>
        {pick.sameSide} of {pick.fieldCount}
      </span>
      {pick.fieldShare >= CHALK_SHARE ? (
        <Tag tone='bg-slate-600/40 text-slate-300'>Chalk</Tag>
      ) : pick.fieldShare <= 1 - CHALK_SHARE ? (
        <Tag tone='bg-violet-400/15 text-violet-200'>Contrarian</Tag>
      ) : null}
    </span>
  );
}

/** A week's result for the log: the points, or that it busted. */
function WeekResult({ week }: { week: LocksWeek }) {
  return week.clean ? (
    <span className='font-semibold tabular-nums text-emerald-300'>
      {plural(week.points, 'pt')}
    </span>
  ) : (
    <span className='text-rose-300'>Busted</span>
  );
}

/** Every pick, newest week first, grouped under the week it scored in. */
function PickLog({ seasons }: { seasons: LocksSeason[] }) {
  const years = seasons.map(season => season.year);
  const [year, setYear] = useState<number | 'all'>(years[0]);

  const weeks = seasons
    .filter(season => year === 'all' || season.year === year)
    .flatMap(season => [...season.weeks].reverse());

  return (
    <ProfileSection
      title='Pick Log'
      action={<YearFilter years={years} value={year} onChange={setYear} />}
    >
      <ProfileTable
        headers={['Week', 'Pick', 'Final', 'Field', 'Result', 'Week Result']}
      >
        {weeks.map(week =>
          week.picks.map((pick, index) => (
            <tr
              key={`${week.year}-${week.week}-${pick.team}`}
              className={clsx(
                index === week.picks.length - 1
                  ? 'border-b border-slate-700/70'
                  : '',
              )}
            >
              {index === 0 && (
                <td
                  rowSpan={week.picks.length}
                  className='whitespace-nowrap px-2 py-2 align-top tabular-nums'
                >
                  {year === 'all' && (
                    <span className='mr-1.5 text-slate-400'>{week.year}</span>
                  )}
                  Week {week.week}
                </td>
              )}
              <td className='whitespace-nowrap px-2 py-1.5'>
                <span className='font-medium text-slate-100'>
                  {pick.team}
                  {pick.spread !== null && ` ${line(pick.spread)}`}
                </span>
                <span className='ml-1.5 text-slate-400'>
                  {pick.isHome ? 'vs' : '@'} {pick.opponent}
                </span>
              </td>
              <td className='whitespace-nowrap px-2 py-1.5 tabular-nums text-slate-300'>
                {pick.teamScore}–{pick.opponentScore}
              </td>
              <td className='whitespace-nowrap px-2 py-1.5'>
                <FieldCell pick={pick} />
              </td>
              <td className='whitespace-nowrap px-2 py-1.5'>
                <Tag tone={RESULT_TAG[pick.result].tone}>
                  {RESULT_TAG[pick.result].label}
                </Tag>
              </td>
              {index === 0 && (
                <td
                  rowSpan={week.picks.length}
                  className='whitespace-nowrap px-2 py-2 align-top'
                  title={`${ordinal(week.rank)} of ${week.fieldSize} that week`}
                >
                  <WeekResult week={week} />
                  <span className='ml-1.5 text-xs text-slate-500'>
                    {ordinal(week.rank)} of {week.fieldSize}
                  </span>
                </td>
              )}
            </tr>
          )),
        )}
      </ProfileTable>
    </ProfileSection>
  );
}
