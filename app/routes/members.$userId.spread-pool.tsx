import type { LoaderFunctionArgs } from '@remix-run/node';
import { Link, useOutletContext } from '@remix-run/react';
import clsx from 'clsx';
import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import CareerCard, { MiniStat } from '~/components/layout/profile/CareerCard';
import ContestEmptyState from '~/components/layout/profile/ContestEmptyState';
import ProfileSection from '~/components/layout/profile/ProfileSection';
import ProfileTable from '~/components/layout/profile/ProfileTable';
import RangeBar from '~/components/layout/profile/RangeBar';
import SplitBar from '~/components/layout/profile/SplitBar';
import WinLoss from '~/components/layout/profile/WinLoss';
import YearFilter from '~/components/layout/profile/YearFilter';
import { requireProfileAccess } from '~/models/profile/access.server';
import { getSpreadPoolProfile } from '~/models/profile/spreadPool.server';
import {
  MAX_BET,
  STARTING_BANK,
  type PoolBet,
  type PoolCareer,
  type PoolSeason,
  type PoolSplits,
  type PoolTeamRow,
  type PoolWeek,
  type Record3,
  type SplitBucket,
  settledRank,
  winRate,
} from '~/models/profile/spreadPoolProfile';
import type { ProfileSummary } from '~/models/profile/summary.server';

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  await requireProfileAccess(request);

  const { userId } = params;
  if (!userId) throw new Response('Not Found', { status: 404 });

  return typedjson({ profile: await getSpreadPoolProfile(userId) });
};

/** "+120", "−40" - a proper minus, so the column lines up. */
const signed = (value: number, digits = 0) =>
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

const pct = (value: number | null, digits = 1) =>
  value === null ? '—' : `${(value * 100).toFixed(digits)}%`;

const plural = (count: number, noun: string) =>
  `${count} ${noun}${count === 1 ? '' : 's'}`;

const ordinal = (rank: number) => {
  const tens = rank % 100;
  if (tens >= 11 && tens <= 13) return `${rank}th`;
  return `${rank}${['th', 'st', 'nd', 'rd'][rank % 10] ?? 'th'}`;
};

const record = ({ wins, losses, pushes }: Record3) =>
  `${wins}-${losses}${pushes ? `-${pushes}` : ''}`;

/** The line as a bettor reads it: "−3", "+6.5", "PK". */
const line = (spread: number) =>
  spread === 0 ? 'PK' : signed(spread, spread % 1 === 0 ? 0 : 1);

const weekLabel = (week: { year: number; week: number }) =>
  `${week.year} Week ${week.week}`;

export default function MemberSpreadPool() {
  const { profile } = useTypedLoaderData<typeof loader>();
  const summary = useOutletContext<ProfileSummary>();

  if (!profile.hasPlayed) {
    return (
      <ContestEmptyState
        contest='the Spread Pool'
        memberName={summary.user.discordName}
      />
    );
  }

  return (
    <div className='space-y-8'>
      <Career career={profile.career} seasons={profile.seasons} />
      <BySeason seasons={profile.seasons} />
      <Bankroll seasons={profile.seasons} />
      <WeekByWeek seasons={profile.seasons} />
      <FavoritesAndUnderdogs splits={profile.splits} />
      <Tendencies splits={profile.splits} />
      <Teams rows={profile.teams} names={profile.teamNames} />
      <BetLog seasons={profile.seasons} />
    </div>
  );
}

/** A RangeBar with its two ends named underneath. */
function LabelledRange({
  low,
  high,
  mark,
  lowLabel,
  highLabel,
  format = value => value.toString(),
}: {
  low: number;
  high: number;
  mark: number;
  lowLabel: string;
  highLabel: string;
  format?: (value: number) => string;
}) {
  return (
    <>
      <RangeBar low={low} high={high} mark={mark} />
      <div className='mt-2 flex justify-between gap-2 text-xs'>
        <span className='min-w-0 truncate'>
          <span className='font-semibold tabular-nums text-rose-300'>
            {format(low)}
          </span>{' '}
          <span className='text-slate-500'>{lowLabel}</span>
        </span>
        <span className='min-w-0 truncate text-right'>
          <span className='text-slate-500'>{highLabel}</span>{' '}
          <span className='font-semibold tabular-nums text-emerald-300'>
            {format(high)}
          </span>
        </span>
      </div>
    </>
  );
}

function Career({
  career,
  seasons,
}: {
  career: PoolCareer;
  seasons: PoolSeason[];
}) {
  const finalBanks = seasons
    .filter(season => !season.inProgress)
    .map(season => season.bank);
  const averageBank =
    finalBanks.length > 0
      ? finalBanks.reduce((total, bank) => total + bank, 0) / finalBanks.length
      : null;

  const bestSeason = seasons
    .map(season => ({ year: season.year, rate: winRate(season.record) }))
    .filter(
      (season): season is { year: number; rate: number } =>
        season.rate !== null,
    )
    .reduce<{ year: number; rate: number } | null>(
      (best, season) => (!best || season.rate > best.rate ? season : best),
      null,
    );

  return (
    <ProfileSection title='Career'>
      <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-4'>
        <CareerCard
          title='Bankroll'
          lead={
            <>
              <span className={signedTone(career.net)}>
                {signed(career.net)}
              </span>
              {career.roe !== null && (
                <LeadContext>
                  <span
                    className={clsx('font-semibold', signedTone(career.roe))}
                  >
                    {signed(career.roe * 100, 1)}%
                  </span>{' '}
                  return
                </LeadContext>
              )}
            </>
          }
          meter={
            // One finished season would put the same bank at both ends, so
            // it keeps the bar's space instead, to stay level with the rest.
            finalBanks.length > 1 &&
            career.bestBank &&
            career.worstBank &&
            averageBank !== null ? (
              <LabelledRange
                low={career.worstBank.bank}
                high={career.bestBank.bank}
                mark={averageBank}
                lowLabel={String(career.worstBank.year)}
                highLabel={String(career.bestBank.year)}
              />
            ) : (
              <div aria-hidden='true' className='h-8' />
            )
          }
        >
          <MiniStat
            label='Total Bet'
            value={career.wagered.toLocaleString()}
            hint='Every point bet, won or lost'
          />
          <MiniStat
            label='Avg Bet'
            value={
              career.averageBet === null ? '—' : career.averageBet.toFixed(1)
            }
            detail={
              career.bets > 0
                ? `${Math.round((career.maxBets / career.bets) * 100)}% max`
                : null
            }
            hint={`Of the ${MAX_BET} a game allowed, and how often they bet all of it`}
          />
        </CareerCard>

        <CareerCard
          title='Bets Won'
          lead={pct(career.winRate)}
          meter={
            <>
              <SplitBar
                wins={career.record.wins}
                losses={career.record.losses}
                ties={career.record.pushes}
              />
              <SplitKey
                record={career.record}
                labels={['won', 'pushed', 'lost']}
              />
            </>
          }
        >
          <MiniStat
            label='Bets'
            value={career.bets.toLocaleString()}
            hint='Every bet placed, pushes included'
          />
          <MiniStat
            label='Best Season'
            value={bestSeason ? pct(bestSeason.rate) : '—'}
            detail={bestSeason ? String(bestSeason.year) : null}
            hint='Their best win rate in a season'
          />
        </CareerCard>

        <WeeksCard career={career} />

        <FinishesCard career={career} seasons={seasons} />
      </div>
    </ProfileSection>
  );
}

/**
 * The counts under a SplitBar, in its colours. Every card with a bar has a row
 * like this under it, which is also what keeps their small stats level.
 */
function SplitKey({
  record,
  labels,
}: {
  record: Record3;
  labels: [win: string, push: string, loss: string];
}) {
  const keys = [
    { count: record.wins, label: labels[0], tone: 'bg-emerald-400' },
    { count: record.pushes, label: labels[1], tone: 'bg-slate-400' },
    { count: record.losses, label: labels[2], tone: 'bg-rose-400' },
  ];

  return (
    <div className='mt-2 flex flex-wrap gap-x-2.5 gap-y-1 text-[0.65rem] text-slate-400'>
      {keys.map(({ count, label, tone }) => (
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

/** How their weeks have gone: up, even and down, and the extremes. */
function WeeksCard({ career }: { career: PoolCareer }) {
  const { weeks, bestWeek, worstWeek } = career;

  return (
    <CareerCard
      title='Up Weeks'
      lead={
        <>
          {career.weeksPlayed > 0
            ? `${Math.round((weeks.wins / career.weeksPlayed) * 100)}%`
            : '—'}
        </>
      }
      meter={
        <>
          <SplitBar
            wins={weeks.wins}
            losses={weeks.losses}
            ties={weeks.pushes}
          />
          <SplitKey record={weeks} labels={['up', 'even', 'down']} />
        </>
      }
    >
      <MiniStat
        label='Won'
        value={career.weeksWon}
        hint='Weeks with the top net of everyone who played'
        tone={career.weeksWon > 0 ? 'text-gold' : undefined}
      />
      <MiniStat
        label='Best'
        value={bestWeek ? signed(bestWeek.net) : '—'}
        hint={bestWeek ? `Best week: ${weekLabel(bestWeek)}` : undefined}
        tone={bestWeek ? signedTone(bestWeek.net) : undefined}
      />
      <MiniStat
        label='Worst'
        value={worstWeek ? signed(worstWeek.net) : '—'}
        hint={worstWeek ? `Worst week: ${weekLabel(worstWeek)}` : undefined}
        tone={worstWeek ? signedTone(worstWeek.net) : undefined}
      />
      <MiniStat
        label='Missed'
        value={career.missedWeeks}
        hint={
          career.missedWeeks > 0
            ? `Weeks with no bets, which cost ${signed(career.missedCost)}`
            : 'Weeks with no bets'
        }
        tone={career.missedWeeks > 0 ? 'text-rose-300' : undefined}
      />
    </CareerCard>
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
  career: PoolCareer;
  seasons: PoolSeason[];
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
            {ordinal(career.standing.rank)}
            <LeadContext>
              of {career.standing.fieldSize} in {career.standing.year}
            </LeadContext>
          </>
        }
      >
        <MiniStat label='Weeks Played' value={career.weeksPlayed} />
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
          <div className='mt-2 flex flex-wrap gap-x-2.5 gap-y-1 text-[0.65rem] text-slate-400'>
            {bandCounts.map(band => (
              <span key={band.label} className='inline-flex items-center gap-1'>
                <span
                  aria-hidden='true'
                  className={clsx(
                    'inline-block h-1.5 w-3 rounded-full',
                    band.tone,
                  )}
                />
                <span className='font-semibold tabular-nums text-slate-200'>
                  {band.count}
                </span>
                {band.label}
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
        label='Up Seasons'
        value={`${career.profitableSeasons}/${career.completedSeasons}`}
        hint={`Finished seasons that ended above the ${STARTING_BANK} they started with`}
      />
    </CareerCard>
  );
}

/** Context set inline after a card's headline, in place of a line under it. */
function LeadContext({ children }: { children: ReactNode }) {
  return (
    <span className='ml-2 text-sm font-normal text-slate-400'>{children}</span>
  );
}

function BySeason({ seasons }: { seasons: PoolSeason[] }) {
  return (
    <ProfileSection title='By Season'>
      <ProfileTable
        headers={[
          'Year',
          'Finish',
          'Bank',
          'Record',
          'Win %',
          'ROE',
          'Best Week',
          'Worst Week',
          'Missed',
        ]}
        numericColumns={[2, 3, 4, 5, 6, 7, 8]}
      >
        {seasons.map(season => (
          <tr key={season.year} className='border-b border-slate-700/70'>
            <td className='px-2 py-2'>
              <Link to={`/games/spread-pool/standings/${season.year}`}>
                {season.year}
              </Link>
              {season.inProgress && <CurrentTag />}
            </td>
            <td className='whitespace-nowrap px-2 py-2'>
              <SeasonFinish season={season} />
            </td>
            <td className='whitespace-nowrap px-2 py-2 text-right tabular-nums'>
              <span className='font-medium'>{season.bank}</span>
              <span className={clsx('ml-1.5 text-xs', signedTone(season.net))}>
                {signed(season.net)}
              </span>
            </td>
            <td className='whitespace-nowrap px-2 py-2 text-right tabular-nums'>
              {record(season.record)}
            </td>
            <td className='px-2 py-2 text-right tabular-nums'>
              {pct(
                season.record.wins + season.record.losses > 0
                  ? season.record.wins /
                      (season.record.wins + season.record.losses)
                  : null,
              )}
            </td>
            <td
              className={clsx(
                'px-2 py-2 text-right tabular-nums',
                signedTone(season.roe),
              )}
            >
              {season.roe === null ? '—' : `${signed(season.roe * 100, 1)}%`}
            </td>
            <WeekCell week={season.bestWeek} />
            <WeekCell week={season.worstWeek} />
            <td
              className={clsx(
                'px-2 py-2 text-right tabular-nums',
                season.missedWeeks > 0 ? 'text-rose-300' : 'text-slate-500',
              )}
            >
              {season.missedWeeks}
            </td>
          </tr>
        ))}
      </ProfileTable>
    </ProfileSection>
  );
}

function WeekCell({ week }: { week: PoolWeek | null }) {
  return (
    <td className='whitespace-nowrap px-2 py-2 text-right tabular-nums'>
      {week ? (
        <>
          <span className={signedTone(week.net)}>{signed(week.net)}</span>
          <span className='ml-1.5 text-xs text-slate-500'>
            Week {week.week}
          </span>
        </>
      ) : (
        '—'
      )}
    </td>
  );
}

function SeasonFinish({ season }: { season: PoolSeason }) {
  if (!season.finish) return <>—</>;

  return (
    <span
      className={clsx(
        'font-medium',
        season.champion ? 'text-gold' : 'text-slate-100',
      )}
    >
      {season.champion && '🏆 '}
      {ordinal(season.finish.rank)}
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

const CHART = { height: 260, left: 44, right: 12, top: 12, bottom: 28 };

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

/**
 * The member's bank through a season, over the field's: the middle half of
 * banks as a band, the whole spread fainter behind it, and the median as a
 * dashed line. Missed weeks are hollow red points, since a penalty is the
 * only way to lose without betting.
 */
function Bankroll({ seasons }: { seasons: PoolSeason[] }) {
  const years = seasons.map(season => season.year);
  const [year, setYear] = useState<number | 'all'>(years[0]);
  const season = seasons.find(entry => entry.year === year) ?? seasons[0];
  const [chartRef, width] = useWidth<HTMLDivElement>(720);

  const points = [
    { week: 0, bank: STARTING_BANK, missed: false, net: 0, label: 'Start' },
    ...season.weeks.map(week => ({
      week: week.week,
      bank: week.bank,
      missed: week.missed,
      net: week.net,
      label: `Week ${week.week}`,
    })),
  ];
  const field = [
    {
      week: 0,
      low: STARTING_BANK,
      high: STARTING_BANK,
      q1: STARTING_BANK,
      q3: STARTING_BANK,
      median: STARTING_BANK,
    },
    ...season.field,
  ];

  const lastWeek = Math.max(
    ...points.map(point => point.week),
    ...field.map(point => point.week),
    1,
  );
  const values = [
    ...points.map(point => point.bank),
    ...field.flatMap(point => [point.low, point.high]),
  ];
  // Rounded out to the next 250 so the gridlines land on round numbers.
  const floor = Math.floor(Math.min(...values) / 250) * 250;
  const ceiling = Math.ceil(Math.max(...values) / 250) * 250;

  const plotWidth = width - CHART.left - CHART.right;
  const plotHeight = CHART.height - CHART.top - CHART.bottom;
  const x = (week: number) => CHART.left + (week / lastWeek) * plotWidth;
  const y = (bank: number) =>
    CHART.top + (1 - (bank - floor) / (ceiling - floor || 1)) * plotHeight;

  const area = (upper: (p: (typeof field)[0]) => number, lower: typeof upper) =>
    [
      ...field.map(point => `${x(point.week)},${y(upper(point))}`),
      ...[...field]
        .reverse()
        .map(point => `${x(point.week)},${y(lower(point))}`),
    ].join(' ');

  const gridlines = Array.from(
    { length: Math.round((ceiling - floor) / 250) + 1 },
    (_, index) => floor + index * 250,
  ).filter((_, index, all) => all.length <= 8 || index % 2 === 0);

  const final = points[points.length - 1];
  // Every other week once they get too close to label, as on a phone.
  const weekStep = plotWidth / lastWeek < 24 ? 2 : 1;

  return (
    <ProfileSection
      title='Bankroll'
      description={
        season.inProgress
          ? `${season.year}: ${final.bank}${
              season.finish
                ? `, ${ordinal(season.finish.rank)} of ${
                    season.finish.fieldSize
                  }`
                : ''
            }`
          : `${season.year}: finished with ${final.bank}${
              season.finish
                ? `, ${ordinal(season.finish.rank)} of ${
                    season.finish.fieldSize
                  }`
                : ''
            }`
      }
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
            Bank
          </ChartKey>
          <ChartKey>
            <span className='inline-block h-2.5 w-4 rounded-sm bg-slate-400/30' />
            Middle half of the field
          </ChartKey>
          <ChartKey>
            <span className='inline-block h-2.5 w-4 rounded-sm bg-slate-400/10' />
            Lowest to highest
          </ChartKey>
          <ChartKey>
            <span className='inline-block w-4 border-t border-dashed border-slate-300' />
            Median
          </ChartKey>
          <ChartKey>
            <span className='inline-block h-2 w-2 rounded-full border-2 border-rose-400' />
            Missed week
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
          aria-label={`Bank through ${season.year}, week by week, against the rest of the field`}
        >
          {gridlines.map(value => (
            <g key={value}>
              <line
                x1={CHART.left}
                x2={width - CHART.right}
                y1={y(value)}
                y2={y(value)}
                className={
                  value === STARTING_BANK
                    ? 'stroke-slate-400'
                    : 'stroke-slate-700'
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
              .map(point => `${x(point.week)},${y(point.bank)}`)
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
              cy={y(point.bank)}
              r={point.missed ? 4.5 : 3.5}
              className={
                point.missed
                  ? 'fill-slate-900 stroke-rose-400'
                  : 'fill-sky-400 stroke-slate-900'
              }
              strokeWidth={2}
            >
              <title>
                {point.label}: {point.bank}
                {point.week > 0 &&
                  ` (${signed(point.net)}${
                    point.missed ? ', missed week' : ''
                  })`}
              </title>
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

/**
 * Where a week's net ranked in the field, bottom to top as dark red to bright
 * green. Ranking rather than raw points, so a week where every favourite
 * covered does not paint the whole column green.
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
 * A week won is set in underlined type, so it stands out by shape and never
 * relies on its colour, which it shares with the rest of the top band.
 */
const WEEK_WON_TEXT = 'underline decoration-2 underline-offset-2';

const MISSED_TONE =
  'border border-dashed border-rose-400/70 bg-transparent text-rose-300';

function weekTone(week: PoolWeek): string {
  if (week.missed) return MISSED_TONE;
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

const describeBet = (bet: PoolBet) =>
  `${
    bet.result === 'win' ? 'Won' : bet.result === 'loss' ? 'Lost' : 'Pushed'
  } ${bet.amount} on ${bet.team} ${line(bet.spread)} ${
    bet.isHome ? 'vs' : '@'
  } ${bet.opponent}`;

const describeWeek = (week: PoolWeek) =>
  week.missed
    ? `${weekLabel(week)}: missed, ${signed(week.net)}. Bank ${week.bank}.`
    : `${weekLabel(week)}: ${signed(week.net)}, ${ordinal(week.rank)} of ${
        week.fieldSize
      }${week.rank === 1 ? ', won the week' : ''}. Bank ${
        week.bank
      }.\n${week.bets.map(describeBet).join('\n')}`;

/** Every season as a strip of weeks, so a career's hot and cold runs show. */
function WeekByWeek({ seasons }: { seasons: PoolSeason[] }) {
  const lastWeek = Math.max(
    ...seasons.flatMap(season => season.weeks.map(week => week.week)),
  );
  const weekNumbers = Array.from({ length: lastWeek }, (_, i) => i + 1);
  const anyMissed = seasons.some(season => season.missedWeeks > 0);

  return (
    <ProfileSection
      title='Week by Week'
      description='Each week’s net, shaded by where it ranked among everyone who played it'
    >
      <div className='overflow-x-auto'>
        <div
          className='grid gap-1.5 p-0.5 text-xs'
          style={{
            gridTemplateColumns: `3rem repeat(${lastWeek}, minmax(3rem, 1fr))`,
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
              <SeasonStrip key={season.year} year={season.year}>
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
                        weekTone(week),
                        week.rank === 1 && !week.missed && WEEK_WON_TEXT,
                      )}
                    >
                      {signed(week.net)}
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
              </SeasonStrip>
            );
          })}
        </div>
      </div>
      <WeekLegend showMissed={anyMissed} />
    </ProfileSection>
  );
}

function SeasonStrip({
  year,
  children,
}: {
  year: number;
  children: ReactNode;
}) {
  return (
    <>
      <div className='flex h-8 items-center font-medium tabular-nums text-slate-300'>
        {year}
      </div>
      {children}
    </>
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

function WeekLegend({ showMissed }: { showMissed: boolean }) {
  return (
    <div className='mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400'>
      <span className='inline-flex items-center gap-1.5'>
        <Swatch tone={clsx(WEEK_SCALE[0].tone, 'w-8 text-[0.65rem]')}>
          <span className={clsx('font-semibold', WEEK_WON_TEXT)}>+150</span>
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
      {showMissed && (
        <span className='inline-flex items-center gap-1.5'>
          <Swatch tone={MISSED_TONE} />
          Missed week
        </span>
      )}
    </div>
  );
}

/**
 * A win rate as a bar out from 50%, the break-even line at even money, with
 * the field's rate as a tick. The track runs 25% to 75%, which is further than
 * any bucket with a real number of bets has gone.
 */
/**
 * Even money means 50% is break-even, so it is drawn through the bar rather
 * than as a tick, and the consensus is a dot - a different shape, so the two
 * are never mistaken for each other.
 */
const BREAK_EVEN_LINE =
  'absolute -inset-y-1 w-0.5 -translate-x-1/2 rounded-full bg-slate-300';
const CONSENSUS_DOT =
  'absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-slate-900 bg-sky-300';

function WinRateBar({
  member,
  field,
}: {
  member: number | null;
  field: number | null;
}) {
  const position = (rate: number) =>
    Math.min(100, Math.max(0, ((rate - 0.25) / 0.5) * 100));

  return (
    <div
      aria-hidden='true'
      className='relative h-2 w-full min-w-[6rem] rounded-full bg-slate-700'
    >
      <div className={clsx('left-1/2', BREAK_EVEN_LINE)} />
      {member !== null && (
        <div
          className={clsx(
            'absolute inset-y-0 rounded-full',
            member >= 0.5 ? 'bg-emerald-400' : 'bg-rose-400',
          )}
          style={{
            left: `${Math.min(50, position(member))}%`,
            width: `${Math.abs(position(member) - 50)}%`,
          }}
        />
      )}
      {field !== null && (
        <div
          className={CONSENSUS_DOT}
          style={{ left: `${position(field)}%` }}
        />
      )}
    </div>
  );
}

/**
 * One row per bucket: how many bets went there, how they did, and how the rest
 * of the field did with the same kind of bet.
 */
function SplitTable({
  buckets,
  heading,
  showField = true,
}: {
  buckets: SplitBucket[];
  heading: string;
  showField?: boolean;
}) {
  const memberBets = buckets.reduce((total, b) => total + b.member.bets, 0);

  return (
    <ProfileTable
      headers={[
        heading,
        'Bets',
        'Record',
        showField ? 'Win % vs consensus' : 'Win %',
        'Net',
      ]}
      numericColumns={[1, 2, 4]}
    >
      {buckets.map(bucket => (
        <tr key={bucket.key} className='border-b border-slate-700/70'>
          <td className='whitespace-nowrap px-2 py-2 text-slate-100'>
            {bucket.label}
          </td>
          <td className='whitespace-nowrap px-2 py-2 text-right tabular-nums'>
            {bucket.member.bets}
            <span className='ml-1.5 text-xs text-slate-500'>
              {memberBets > 0
                ? `${Math.round((bucket.member.bets / memberBets) * 100)}%`
                : ''}
            </span>
          </td>
          <td className='whitespace-nowrap px-2 py-2 text-right tabular-nums'>
            {record(bucket.member)}
          </td>
          <td
            className='w-1/2 px-2 py-2 tabular-nums'
            title={
              showField
                ? `Consensus: ${pct(bucket.field.winRate)} on ${plural(
                    bucket.field.bets,
                    'bet',
                  )}`
                : undefined
            }
          >
            <div className='flex items-center gap-3'>
              <span className='w-24 shrink-0 whitespace-nowrap'>
                {pct(bucket.member.winRate)}
                {showField && (
                  <span className='ml-1.5 text-xs text-slate-500'>
                    {pct(bucket.field.winRate)}
                  </span>
                )}
              </span>
              <WinRateBar
                member={bucket.member.bets > 0 ? bucket.member.winRate : null}
                field={showField ? bucket.field.winRate : null}
              />
            </div>
          </td>
          <td
            className={clsx(
              'whitespace-nowrap px-2 py-2 text-right font-medium tabular-nums',
              signedTone(bucket.member.net),
            )}
          >
            {signed(bucket.member.net)}
          </td>
        </tr>
      ))}
    </ProfileTable>
  );
}

function WinRateKey() {
  return (
    <span className='inline-flex flex-wrap items-center gap-x-4 gap-y-1'>
      <span className='inline-flex items-center gap-1.5'>
        <span className='relative inline-block h-3 w-3'>
          <span className={clsx('left-1/2', BREAK_EVEN_LINE)} />
        </span>
        Break even
      </span>
      <span className='inline-flex items-center gap-1.5'>
        <span className='relative inline-block h-3 w-3'>
          <span className={clsx('left-1/2', CONSENSUS_DOT)} />
        </span>
        Consensus: how everyone else&rsquo;s bets of the same kind did
      </span>
    </span>
  );
}

/** How their bets on one side of the line have gone. */
function SideCard({
  bucket,
  share,
  tone,
}: {
  bucket: SplitBucket;
  share: number;
  tone: string;
}) {
  const { member } = bucket;
  const averageBet = member.bets > 0 ? member.wagered / member.bets : null;

  return (
    <CareerCard
      title={
        <span className='inline-flex items-center gap-2'>
          <span
            aria-hidden='true'
            className={clsx('inline-block h-2 w-2 rounded-full', tone)}
          />
          {bucket.label}
        </span>
      }
      lead={
        <>
          {pct(member.winRate)}
          <LeadContext>
            <WinLoss
              wins={member.wins}
              losses={member.losses}
              ties={member.pushes}
            />
          </LeadContext>
        </>
      }
      meter={<WinRateBar member={member.winRate} field={null} />}
    >
      <MiniStat
        label='Net'
        value={signed(member.net)}
        tone={signedTone(member.net)}
      />
      <MiniStat
        label='Share'
        value={`${Math.round(share * 100)}%`}
        hint='Share of their bets'
      />
      <MiniStat
        label='Avg Bet'
        value={averageBet === null ? '—' : averageBet.toFixed(1)}
      />
    </CareerCard>
  );
}

const SIDE_TONE: Record<string, string> = {
  favorite: 'bg-amber-400',
  underdog: 'bg-violet-400',
  pick: 'bg-slate-400',
};

/**
 * Whether they give points or take them, how that has gone, and which lines
 * they do best on - all next to the rest of the field.
 */
function FavoritesAndUnderdogs({ splits }: { splits: PoolSplits }) {
  const memberTotal = splits.side.reduce((t, b) => t + b.member.bets, 0);
  const fieldTotal = splits.side.reduce((t, b) => t + b.field.bets, 0);
  const shareOf = (bucket: SplitBucket) =>
    memberTotal > 0 ? bucket.member.bets / memberTotal : 0;
  const fieldShareOf = (bucket: SplitBucket) =>
    fieldTotal > 0 ? bucket.field.bets / fieldTotal : 0;

  const favorite = splits.side.find(bucket => bucket.key === 'favorite');
  const underdog = splits.side.find(bucket => bucket.key === 'underdog');

  return (
    <ProfileSection title='Favorites & Underdogs' footnote={<WinRateKey />}>
      <ShareBar
        buckets={splits.side}
        shareOf={shareOf}
        consensus={favorite ? fieldShareOf(favorite) : null}
      />
      <div className='mb-6 mt-4 grid gap-3 md:grid-cols-2'>
        {[favorite, underdog].map(
          bucket =>
            bucket && (
              <SideCard
                key={bucket.key}
                bucket={bucket}
                share={shareOf(bucket)}
                tone={SIDE_TONE[bucket.key]}
              />
            ),
        )}
      </div>
      <h4 className='m-0 mb-2 text-sm font-semibold text-slate-300'>
        By the line
      </h4>
      <SplitTable buckets={splits.line} heading='Line' />
    </ProfileSection>
  );
}

/**
 * How their bets split between favorites and underdogs, with a tick where the
 * consensus split falls - so a lean either way shows as the gap between the
 * two.
 */
function ShareBar({
  buckets,
  shareOf,
  consensus,
}: {
  buckets: SplitBucket[];
  shareOf: (bucket: SplitBucket) => number;
  /** The field's share on favorites, which is where the first segment ends. */
  consensus: number | null;
}) {
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
                bucket.key === 'underdog' && 'justify-end',
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
          title={`Consensus: ${Math.round(consensus * 100)}% favorites`}
        />
      )}
    </div>
  );
}

/** The other ways to slice a bet: its size, the venue, the crowd and the clock. */
function Tendencies({ splits }: { splits: PoolSplits }) {
  return (
    <ProfileSection title='Tendencies' footnote={<WinRateKey />}>
      {/* min-w-0 lets each table scroll inside its cell on a phone, rather
          than widening the grid past the screen. */}
      <div className='grid gap-6 xl:grid-cols-2 [&>*]:min-w-0'>
        <SplitTable buckets={splits.size} heading='Bet size' />
        <SplitTable buckets={splits.venue} heading='Venue' />
        <SplitTable buckets={splits.slot} heading='Kickoff' />
        <div>
          <SplitTable
            buckets={splits.crowd}
            heading='Rest of the field'
            showField={false}
          />
        </div>
      </div>
    </ProfileSection>
  );
}

type TeamSort = 'net' | 'backing' | 'fading' | 'bets';

const TEAM_SORTS: { key: TeamSort; label: string }[] = [
  { key: 'net', label: 'Total' },
  { key: 'backing', label: 'Backing' },
  { key: 'fading', label: 'Fading' },
  { key: 'bets', label: 'Most bet' },
];

const TEAMS_PREVIEW = 12;

const teamBets = (row: PoolTeamRow) => row.backing.bets + row.fading.bets;

function sortTeams(rows: PoolTeamRow[], sort: TeamSort) {
  const value = (row: PoolTeamRow) =>
    sort === 'net'
      ? row.net
      : sort === 'backing'
      ? row.backing.net
      : sort === 'fading'
      ? row.fading.net
      : teamBets(row);
  return [...rows].sort(
    (a, b) => value(b) - value(a) || a.team.localeCompare(b.team),
  );
}

/** A net as a bar out from the middle, scaled to the widest in the table. */
function NetBar({ value, widest }: { value: number; widest: number }) {
  const width = widest > 0 ? (Math.abs(value) / widest) * 50 : 0;
  return (
    <div
      aria-hidden='true'
      className='relative hidden h-2 w-24 rounded-full bg-slate-700/60 sm:block'
    >
      <div className='absolute inset-y-0 left-1/2 w-px bg-slate-500' />
      <div
        className={clsx(
          'absolute inset-y-0 rounded-full',
          value >= 0 ? 'bg-emerald-400' : 'bg-rose-400',
        )}
        style={{
          left: value >= 0 ? '50%' : `${50 - width}%`,
          width: `${width}%`,
        }}
      />
    </div>
  );
}

function TeamCallout({
  title,
  row,
  names,
  children,
}: {
  title: string;
  row: PoolTeamRow | undefined;
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
 * A team's bets split into backing it and fading it, as a bar with each side's
 * count and net at its end.
 */
function BackedFaded({ row }: { row: PoolTeamRow }) {
  const total = teamBets(row);
  const sides = [
    { label: 'Backed', side: row.backing, tone: 'bg-sky-400' },
    { label: 'Faded', side: row.fading, tone: 'bg-violet-400' },
  ];

  return (
    <>
      <span>
        {plural(total, 'bet')},{' '}
        <span className={clsx('font-semibold', signedTone(row.net))}>
          {signed(row.net)}
        </span>
      </span>
      <div
        aria-hidden='true'
        className='mt-3 flex h-2 gap-0.5 overflow-hidden rounded-full bg-slate-700'
      >
        {sides
          .filter(({ side }) => side.bets > 0)
          .map(({ label, side, tone }) => (
            <div
              key={label}
              className={tone}
              style={{ width: `${(side.bets / total) * 100}%` }}
            />
          ))}
      </div>
      <div className='mt-2 flex justify-between gap-2 text-xs'>
        {sides.map(({ label, side, tone }, index) => (
          <span
            key={label}
            className={clsx(
              'inline-flex items-center gap-1.5',
              index === 1 && 'flex-row-reverse',
            )}
          >
            <span
              aria-hidden='true'
              className={clsx('inline-block h-1.5 w-3 rounded-full', tone)}
            />
            <span className='text-slate-300'>
              {label} {side.bets}
            </span>
            <span className={clsx('font-semibold', signedTone(side.net))}>
              {signed(side.net)}
            </span>
          </span>
        ))}
      </div>
    </>
  );
}

/**
 * Every team they have bet on or against. Backing and fading are kept apart,
 * since a team they always lose with and always win against nets to nothing.
 */
function Teams({
  rows,
  names,
}: {
  rows: PoolTeamRow[];
  names: Record<string, string>;
}) {
  const [sort, setSort] = useState<TeamSort>('net');
  const [showAll, setShowAll] = useState(false);
  const sorted = sortTeams(rows, sort);
  const visible = showAll ? sorted : sorted.slice(0, TEAMS_PREVIEW);
  const widest = Math.max(
    ...rows.flatMap(row => [
      Math.abs(row.backing.net),
      Math.abs(row.fading.net),
      Math.abs(row.net),
    ]),
    1,
  );

  const mostProfitable = rows[0]?.net > 0 ? rows[0] : undefined;
  const leastProfitable =
    rows[rows.length - 1]?.net < 0 ? rows[rows.length - 1] : undefined;
  const mostBet = sortTeams(rows, 'bets')[0];

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
        <TeamCallout title='Most Profitable' row={mostProfitable} names={names}>
          {mostProfitable && <BackedFaded row={mostProfitable} />}
        </TeamCallout>
        <TeamCallout
          title='Least Profitable'
          row={leastProfitable}
          names={names}
        >
          {leastProfitable && <BackedFaded row={leastProfitable} />}
        </TeamCallout>
        <TeamCallout title='Most Often Bet' row={mostBet} names={names}>
          {mostBet && <BackedFaded row={mostBet} />}
        </TeamCallout>
      </div>

      <ProfileTable
        headers={['Team', 'Backing', 'Fading', 'Total']}
        numericColumns={[3]}
      >
        {visible.map(row => (
          <tr key={row.team} className='border-b border-slate-700/70'>
            <td
              className='whitespace-nowrap px-2 py-2 font-medium text-slate-100'
              title={names[row.team]}
            >
              {row.team}
            </td>
            <TeamSide side={row.backing} widest={widest} />
            <TeamSide side={row.fading} widest={widest} />
            <td
              className={clsx(
                'whitespace-nowrap px-2 py-2 text-right font-semibold tabular-nums',
                signedTone(row.net),
              )}
            >
              {signed(row.net)}
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

/** One side's record and net, with the net drawn as a bar beside it. */
function TeamSide({
  side,
  widest,
}: {
  side: PoolTeamRow['backing'];
  widest: number;
}) {
  return (
    <td className='whitespace-nowrap px-2 py-2 tabular-nums'>
      {side.bets > 0 ? (
        <div className='flex items-center gap-3'>
          <span className='w-24 shrink-0 text-right'>
            <span className='text-slate-300'>{record(side)}</span>
            <span className={clsx('ml-2', signedTone(side.net))}>
              {signed(side.net)}
            </span>
          </span>
          <NetBar value={side.net} widest={widest} />
        </div>
      ) : (
        <span className='text-slate-600'>—</span>
      )}
    </td>
  );
}

function Tag({ tone, children }: { tone: string; children: ReactNode }) {
  return (
    <span className={clsx('rounded px-1.5 py-0.5 text-xs', tone)}>
      {children}
    </span>
  );
}

const RESULT_TAG: Record<PoolBet['result'], { tone: string; label: string }> = {
  win: { tone: 'bg-emerald-400/15 text-emerald-200', label: 'Won' },
  loss: { tone: 'bg-rose-400/15 text-rose-200', label: 'Lost' },
  push: { tone: 'bg-slate-600/40 text-slate-300', label: 'Push' },
};

function BetLog({ seasons }: { seasons: PoolSeason[] }) {
  const years = seasons.map(season => season.year);
  const [year, setYear] = useState<number | 'all'>(years[0]);

  const bets = seasons
    .filter(season => year === 'all' || season.year === year)
    .flatMap(season =>
      [...season.weeks]
        .reverse()
        .flatMap(week =>
          [...week.bets].sort(
            (a, b) =>
              new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime(),
          ),
        ),
    );

  return (
    <ProfileSection
      title='Bet Log'
      action={<YearFilter years={years} value={year} onChange={setYear} />}
    >
      <ProfileTable
        headers={[
          'Year',
          'Week',
          'Bet',
          'Amount',
          'Final',
          'Cover',
          'Net',
          'Result',
        ]}
        numericColumns={[3, 5, 6]}
      >
        {bets.map((bet, index) => (
          <tr
            key={`${bet.year}-${bet.week}-${bet.team}-${index}`}
            className='border-b border-slate-700/70'
          >
            <td className='px-2 py-2'>{bet.year}</td>
            <td className='px-2 py-2 tabular-nums'>{bet.week}</td>
            <td className='whitespace-nowrap px-2 py-2'>
              <span className='font-medium text-slate-100'>
                {bet.team} {line(bet.spread)}
              </span>
              <span className='ml-1.5 text-slate-400'>
                {bet.isHome ? 'vs' : '@'} {bet.opponent}
              </span>
            </td>
            <td
              className={clsx(
                'px-2 py-2 text-right tabular-nums',
                bet.amount >= MAX_BET && 'font-semibold text-slate-100',
              )}
            >
              {bet.amount}
            </td>
            <td className='whitespace-nowrap px-2 py-2 tabular-nums text-slate-300'>
              {bet.teamScore}–{bet.opponentScore}
            </td>
            <td
              className={clsx(
                'px-2 py-2 text-right tabular-nums',
                signedTone(bet.coverMargin),
              )}
            >
              {signed(bet.coverMargin, bet.coverMargin % 1 === 0 ? 0 : 1)}
            </td>
            <td
              className={clsx(
                'px-2 py-2 text-right font-medium tabular-nums',
                signedTone(bet.net),
              )}
            >
              {signed(bet.net)}
            </td>
            <td className='whitespace-nowrap px-2 py-2'>
              <Tag tone={RESULT_TAG[bet.result].tone}>
                {RESULT_TAG[bet.result].label}
              </Tag>
              {bet.fieldShare !== null && bet.fieldShare < 0.5 && (
                <Tag tone='ml-1 bg-violet-400/15 text-violet-200'>
                  <span
                    title={`${Math.round(
                      bet.fieldShare * 100,
                    )}% of the others who bet this game took the same side`}
                  >
                    Contrarian
                  </span>
                </Tag>
              )}
            </td>
          </tr>
        ))}
      </ProfileTable>
    </ProfileSection>
  );
}
